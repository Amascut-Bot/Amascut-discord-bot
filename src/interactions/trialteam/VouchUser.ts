import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, User } from 'discord.js';
import { Vouch } from '../../entity/Vouch';
import { VouchBlacklist } from '../../entity/VouchBlacklist';
import TicketHandler from '../../modules/TicketHandler';

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

        const hierarchy = ['elite500', 'elite1000', 'elite2000'];
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

        const allVouchesForUser = await vouchRepository.find({
            where: {
                vouchee: targetUser.id,
                status: 'pending'
            }
        });

        let highestQualifyingRole: string | null = null;
        let qualifyingVouchesForTicket: Vouch[] = [];

        for (let i = roleIndex; i >= 0; i--) {
            const checkRole = hierarchy[i];

            const qualifyingVouches = allVouchesForUser.filter(v => {
                const vouchRoleIndex = hierarchy.indexOf(v.role);
                return vouchRoleIndex >= i;
            });

            const existingTicketForRole = allVouchesForUser.some(v =>
                v.ticketRole === checkRole
            );

            if (qualifyingVouches.length >= REQUIRED_VOUCHES && !existingTicketForRole) {
                highestQualifyingRole = checkRole;
                qualifyingVouchesForTicket = qualifyingVouches.slice(0, REQUIRED_VOUCHES);
                break;
            }
        }

        if (highestQualifyingRole) {
            try {
                await TicketHandler.createVouchTicket(this.client, interaction, targetUser, highestQualifyingRole, qualifyingVouchesForTicket);
            } catch (error) {
                await vouchRepository.remove(vouch);
                this.client.logger.error({ message: 'Failed to create vouch ticket — vouch rolled back', error, handler: this.constructor.name });
                return await interaction.editReply('Failed to create the vouch ticket. Your vouch has not been counted — please try again.');
            }
        }

        await interaction.editReply(`Vouch submitted for <@${targetUser.id}> - ${this.client.roles[roleKey]}`);
    }
}
