import BotInteraction from '../../types/BotInteraction';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, OverwriteType, PermissionFlagsBits, SlashCommandBuilder, TextChannel, User } from 'discord.js';
import { Vouch } from '../../entity/Vouch';
import { Ticket } from '../../entity/Ticket';
import { VouchBlacklist } from '../../entity/VouchBlacklist';

export default class VouchUser extends BotInteraction {
    get name() {
        return 'vouch';
    }

    get description() {
        return 'Vouch for a user to receive an elite role';
    }

    get permissions() {
        return 'EVERYONE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option => option.setName('user').setDescription('User to vouch for').setRequired(true))
            .addStringOption(option => option.setName('role').setDescription('Elite role').setRequired(true)
                .addChoices(
                    { name: 'Elite 500', value: 'elite500' },
                    { name: 'Elite 750', value: 'elite750' },
                    { name: 'Elite 1000', value: 'elite1000' },
                    { name: 'Elite 2000', value: 'elite2000' }
                ))
            .addStringOption(option => option.setName('rsn').setDescription('RSN of the user').setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('Describe how the hour went').setRequired(true).setMaxLength(2000));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser: User = interaction.options.getUser('user', true);
        const roleKey = interaction.options.getString('role', true);
        const rsn = interaction.options.getString('rsn', true).trim();
        const description = interaction.options.getString('description', true).trim();

        const blacklistRepository = this.client.dataSource.getRepository(VouchBlacklist);
        const isBlacklisted = await blacklistRepository.findOne({ where: { userId: interaction.user.id } });

        if (isBlacklisted) {
            return await interaction.editReply('You are blacklisted from vouching.');
        }

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const userRoleIds = member?.roles.cache.map(r => r.id) || [];
        
        const hierarchy = ['elite500', 'elite750', 'elite1000', 'elite2000'];
        const roleIndex = hierarchy.indexOf(roleKey);
        const hasRoleOrHigher = hierarchy.slice(roleIndex).some(role => 
            userRoleIds.includes(this.client.roleIds[role])
        );

        if (!hasRoleOrHigher) {
            return await interaction.editReply(`You must have ${this.client.roles[roleKey]} or higher to vouch for this role.`);
        }

        const vouchRepository = this.client.dataSource.getRepository(Vouch);
        
        const existingVouch = await vouchRepository.findOne({ 
            where: { 
                voucher: interaction.user.id, 
                vouchee: targetUser.id, 
                role: roleKey,
                status: 'pending'
            } 
        });

        if (existingVouch) {
            return await interaction.editReply(`You have already vouched for this user at ${this.client.roles[roleKey]}.`);
        }

        const vouch = vouchRepository.create({
            voucher: interaction.user.id,
            vouchee: targetUser.id,
            rsn: rsn,
            role: roleKey,
            description: description,
            status: 'pending'
        });
        await vouchRepository.save(vouch);

        const REQUIRED_VOUCHES = 2;

        // Get all pending vouches for this user
        const allVouchesForUser = await vouchRepository.find({ 
            where: { 
                vouchee: targetUser.id,
                status: 'pending'
            } 
        });

        // Find the highest tier that qualifies (has 2+ vouches) and doesn't have a ticket yet
        let highestQualifyingRole: string | null = null;
        let qualifyingVouchesForTicket: Vouch[] = [];

        // Loop from highest to lowest (reverse)
        for (let i = roleIndex; i >= 0; i--) {
            const checkRole = hierarchy[i];
            
            // Count vouches that are for the checkRole or any role higher in hierarchy
            const qualifyingVouches = allVouchesForUser.filter(v => {
                const vouchRoleIndex = hierarchy.indexOf(v.role);
                return vouchRoleIndex >= i;
            });

            // Check if ticket already exists for this specific role
            const existingTicketForRole = allVouchesForUser.some(v => 
                v.ticketRole === checkRole
            );
            
            if (qualifyingVouches.length >= REQUIRED_VOUCHES && !existingTicketForRole) {
                highestQualifyingRole = checkRole;
                qualifyingVouchesForTicket = qualifyingVouches.slice(0, REQUIRED_VOUCHES);
                break;
            }
        }

        // Create ticket for the highest qualifying role only
        if (highestQualifyingRole) {
            await this.createVouchTicket(interaction, targetUser, highestQualifyingRole, qualifyingVouchesForTicket);
        }
        
        await interaction.editReply(`Vouch submitted for <@${targetUser.id}> - ${this.client.roles[roleKey]}`);
    }

    private async createVouchTicket(interaction: ChatInputCommandInteraction, targetUser: User, roleKey: string, vouches: Vouch[]) {
        const vouchCount = await this.client.dataSource.getRepository(Vouch).count();
        const channelName = `vouch-${vouchCount.toString().padStart(4, '0')}`;

        const ticketChannel = await interaction.guild?.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: this.client.channelIds.vouchTicketsCategory,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: targetUser.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    type: OverwriteType.Member
                },
                {
                    id: this.client.roleIds.admin,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    type: OverwriteType.Role
                },
                {
                    id: this.client.roleIds.owner,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    type: OverwriteType.Role
                },
                {
                    id: this.client.roleIds.trialTeam,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    type: OverwriteType.Role
                }
            ]
        }) as TextChannel;

        if (!ticketChannel) return;

        const vouchFields = vouches.map((v, i) => ({
            name: `Vouch ${i + 1}`,
            value: `**Voucher:** <@${v.voucher}>\n**RSN:** ${v.rsn}\n**Description:** ${v.description}`,
            inline: false
        }));

        const vouchEmbed = new EmbedBuilder()
            .setTitle('Elite Role Vouch - Approval Required')
            .setColor(this.client.color)
            .addFields(
                { name: 'Vouchee', value: `<@${targetUser.id}>`, inline: false },
                { name: 'Role', value: this.client.roles[roleKey], inline: false },
                ...vouchFields,
                { name: 'Votes', value: '✅ 0 | ❌ 0', inline: false }
            )
            .setTimestamp();

        const approveButton = new ButtonBuilder()
            .setCustomId('vouch_approve')
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success);

        const rejectButton = new ButtonBuilder()
            .setCustomId('vouch_reject')
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger);

        const closeButton = new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Secondary);

        const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(approveButton, rejectButton);
        const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

        await ticketChannel.send({ embeds: [vouchEmbed], components: [voteRow, controlRow] });

        const ticketRepository = this.client.dataSource.getRepository(Ticket);
        const ticket = ticketRepository.create({
            channelId: ticketChannel.id,
            userOpen: targetUser.id,
            ticketType: 3
        });
        await ticketRepository.save(ticket);

        const vouchRepository = this.client.dataSource.getRepository(Vouch);
        for (const vouch of vouches) {
            vouch.ticketChannelId = ticketChannel.id;
            vouch.ticketRole = roleKey;
            await vouchRepository.save(vouch);
        }

        await interaction.followUp({ 
            content: `Vouch ticket created for <@${targetUser.id}>: <#${ticketChannel.id}>`, 
            flags: MessageFlags.Ephemeral 
        });
    }
}