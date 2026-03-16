import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, MessageFlags, TextChannel } from 'discord.js';
import Bot from '../Bot';
import { Vouch } from '../entity/Vouch';
import { VouchVote } from '../entity/VouchVote';

export default class VouchHandler {
    client: Bot;
    id: string;
    interaction: Interaction;

    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (id === 'vouch_approve' && interaction.isButton()) {
            this.handleVote(interaction as ButtonInteraction<'cached'>, 'approve');
            return;
        }

        if (id === 'vouch_reject' && interaction.isButton()) {
            this.handleVote(interaction as ButtonInteraction<'cached'>, 'reject');
            return;
        }
    }

    private async handleVote(interaction: ButtonInteraction<'cached'>, voteType: 'approve' | 'reject') {
        if (!await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction)) {
            return await interaction.reply({
                content: 'Only Trial Team members can vote.',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferUpdate();

        try {
            const vouchRepository = this.client.dataSource.getRepository(Vouch);
            const voteRepository = this.client.dataSource.getRepository(VouchVote);

            const vouches = await vouchRepository.find({ where: { ticketChannelId: interaction.channel!.id } });
            if (!vouches.length) {
                return await interaction.followUp({ content: 'Could not find vouch data.', flags: MessageFlags.Ephemeral });
            }

            const firstVouch = vouches[0];
            const member = await interaction.guild?.members.fetch(interaction.user.id);
            const userRoleIds = member?.roles.cache.map(r => r.id) || [];

            const hierarchy = ['elite500', 'elite1000', 'elite2000'];
            const roleIndex = hierarchy.indexOf(firstVouch.role);
            const hasRoleOrHigher = hierarchy.slice(roleIndex).some(role =>
                userRoleIds.includes(this.client.roleIds[role])
            );

            if (!hasRoleOrHigher) {
                return await interaction.followUp({
                    content: `You must have ${this.client.roles[firstVouch.role]} or higher to vote on this vouch.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            let existingVote = await voteRepository.findOne({ where: { vouchId: firstVouch.id, voterId: interaction.user.id } });

            if (existingVote) {
                existingVote.vote = voteType;
                await voteRepository.save(existingVote);
            } else {
                const newVote = voteRepository.create({
                    vouchId: firstVouch.id,
                    voterId: interaction.user.id,
                    vote: voteType
                });
                await voteRepository.save(newVote);
            }

            const allVotes = await voteRepository.find({ where: { vouchId: firstVouch.id } });
            const approveCount = allVotes.filter(v => v.vote === 'approve').length;
            const rejectCount = allVotes.filter(v => v.vote === 'reject').length;

            const embed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(embed);

            const voteFieldIndex = updatedEmbed.data.fields?.findIndex(f => f.name === 'Votes');
            if (voteFieldIndex !== undefined && voteFieldIndex !== -1 && updatedEmbed.data.fields) {
                updatedEmbed.data.fields[voteFieldIndex].value = `✅ ${approveCount} | ❌ ${rejectCount}`;
            }

            await interaction.message.edit({ embeds: [updatedEmbed] });

            // CHANGE THIS NUMBER TO INCREASE APPROVAL THRESHOLD BECAUSE I WILL FORGET!!!!
            const APPROVAL_THRESHOLD = 1;

            if (approveCount >= APPROVAL_THRESHOLD) {
                await this.approveVouch(interaction, firstVouch);
            }
        } catch (error) {
            this.client.logger.error({
                message: 'Failed to handle vouch vote',
                error,
                handler: this.constructor.name
            });
        }
    }

    private async approveVouch(interaction: ButtonInteraction<'cached'>, vouch: Vouch) {
        try {
            const vouchRepository = this.client.dataSource.getRepository(Vouch);
            const vouches = await vouchRepository.find({ where: { ticketChannelId: interaction.channel!.id } });

            const member = await interaction.guild?.members.fetch(vouch.vouchee);
            if (!member) return;

            const hierarchy = ['elite500', 'elite1000', 'elite2000'];
            const roleIndex = hierarchy.indexOf(vouch.role);
            const rolesToAdd = [this.client.roleIds[vouch.role], this.client.roleIds.elite];

            hierarchy.slice(0, roleIndex).forEach(role => rolesToAdd.push(this.client.roleIds[role]));
            await member.roles.add(rolesToAdd);

            const roleObject = await interaction.guild?.roles.fetch(this.client.roleIds[vouch.role]);

            let messageUrl = '';
            const confirmChannel = this.client.channelIds.achievements
                ? await this.client.channels.fetch(this.client.channelIds.achievements) as TextChannel : null;

            if (confirmChannel) {
                const msg = await confirmChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleObject?.hexColor || this.client.color)
                        .setDescription(`Congratulations to <@${vouch.vouchee}> on achieving ${this.client.roles[vouch.role]}!`)
                        .setTimestamp()]
                });
                messageUrl = msg.url;
            }

            const logChannel = this.client.channelIds.roleAssignLogs
                ? await this.client.channels.fetch(this.client.channelIds.roleAssignLogs) as TextChannel : null;

            if (logChannel) {
                const voucherList = vouches.map(v => `<@${v.voucher}>`).join(', ');
                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleObject?.hexColor || this.client.color)
                        .setDescription(`${this.client.roles[vouch.role]} and ${this.client.roles.elite} assigned to <@${vouch.vouchee}> via vouch by ${voucherList}.${messageUrl ? `\n**Message**: ${messageUrl}` : ''}`)
                        .setTimestamp()],
                    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('rejectRoleAssign').setLabel('Reject Approval').setStyle(ButtonStyle.Danger)
                    )]
                });
            }

            for (const v of vouches) {
                v.status = 'approved';
                await vouchRepository.save(v);
            }

            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Secondary);

            const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

            await interaction.message.edit({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00ff00).setTitle('Elite Role Vouch - APPROVED')],
                components: [closeRow]
            });
        } catch (error) {
            this.client.logger.error({ message: 'Failed to approve vouch', error, handler: this.constructor.name });
        }
    }
}
