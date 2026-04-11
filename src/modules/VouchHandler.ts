import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, Message, MessageFlags, TextChannel } from 'discord.js';
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
        if (!await this.client.util.hasRolePermissions(this.client, ['vouchTeam', 'admin', 'owner'], interaction)) {
            return await interaction.reply({
                content: 'Only Vouch Team members can vote.',
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

            const APPROVAL_THRESHOLD = 1;
            const REJECTION_THRESHOLD = 1;

            if (rejectCount >= REJECTION_THRESHOLD) {
                await this.rejectVouch(interaction, firstVouch);
            } else if (approveCount >= APPROVAL_THRESHOLD) {
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

            const existingRoleIds = member.roles.cache.map((role) => role.id);
            const roleTransition = this.client.util.getTrialRoleTransition(existingRoleIds, vouch.role);
            const rolesToAdd = roleTransition.addedRoleIds;
            const rolesToRemove = roleTransition.removedRoleIds;
            const grantedRoleMentions = roleTransition.addedRoleMentions;
            const removedRoleMentions = roleTransition.removedRoleMentions;
            const hasRoleChanges = rolesToAdd.length > 0 || rolesToRemove.length > 0;
            const exactRoleId = this.client.roleIds[vouch.role];
            const newlyEarnedTier = Boolean(exactRoleId && !existingRoleIds.includes(exactRoleId));

            if (rolesToRemove.length > 0) {
                await member.roles.remove(rolesToRemove);
            }

            if (rolesToAdd.length > 0) {
                await member.roles.add(rolesToAdd);
            }

            const roleObject = await interaction.guild?.roles.fetch(this.client.roleIds[vouch.role]);

            let confirmationMessage: Message | null = null;
            let messageUrl = '';
            const confirmChannel = this.client.channelIds.achievements
                ? await this.client.channels.fetch(this.client.channelIds.achievements) as TextChannel : null;

            if (confirmChannel && newlyEarnedTier) {
                const msg = await confirmChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleObject?.hexColor || this.client.color)
                        .setDescription(`Congratulations to <@${vouch.vouchee}> on achieving ${this.client.roles[vouch.role]}!`)
                        .setTimestamp()]
                });
                confirmationMessage = msg;
                messageUrl = msg.url;
            }

            const logChannel = this.client.channelIds.roleAssignLogs
                ? await this.client.channels.fetch(this.client.channelIds.roleAssignLogs) as TextChannel : null;

            if (logChannel) {
                const voucherList = vouches.map(v => `<@${v.voucher}>`).join(', ');
                const changeLines: string[] = [];

                if (grantedRoleMentions.length > 0) {
                    changeLines.push(`${grantedRoleMentions.join(', ')} assigned to <@${vouch.vouchee}> via vouch by ${voucherList}.`);
                }

                if (removedRoleMentions.length > 0) {
                    changeLines.push(`${removedRoleMentions.join(', ')} removed from <@${vouch.vouchee}>.`);
                }

                if (!hasRoleChanges) {
                    changeLines.push(`<@${vouch.vouchee}> already had every applicable role for ${this.client.roles[vouch.role]}. No role changes were needed.`);
                }

                if (messageUrl) {
                    changeLines.push(`**Message**: ${messageUrl}`);
                }

                const roleAssignmentLog = hasRoleChanges
                    ? await this.client.util.createRoleAssignmentLog({
                        targetUserId: vouch.vouchee,
                        actorUserId: interaction.user.id,
                        source: 'vouch-approve',
                        addedRoleIds: rolesToAdd,
                        removedRoleIds: rolesToRemove,
                        announcementChannelId: confirmationMessage?.channelId ?? null,
                        announcementMessageId: confirmationMessage?.id ?? null
                    })
                    : null;

                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleObject?.hexColor || this.client.color)
                        .setDescription(changeLines.join('\n'))
                        .setTimestamp()],
                    components: roleAssignmentLog
                        ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder().setCustomId(this.client.util.getRejectRoleAssignCustomId(roleAssignmentLog.id)).setLabel('Reject Approval').setStyle(ButtonStyle.Danger)
                        )]
                        : []
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

    private async rejectVouch(interaction: ButtonInteraction<'cached'>, vouch: Vouch) {
        try {
            const vouchRepository = this.client.dataSource.getRepository(Vouch);
            const vouches = await vouchRepository.find({ where: { ticketChannelId: interaction.channel!.id } });

            for (const v of vouches) {
                v.status = 'rejected';
                await vouchRepository.save(v);
            }

            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Secondary);

            await interaction.message.edit({
                embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xff0000).setTitle('Elite Role Vouch - REJECTED')],
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton)]
            });
        } catch (error) {
            this.client.logger.error({ message: 'Failed to reject vouch', error, handler: this.constructor.name });
        }
    }
}
