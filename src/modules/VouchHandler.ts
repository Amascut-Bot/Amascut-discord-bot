import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import Bot from '../Bot';
import { Vouch } from '../entity/Vouch';
import { VouchBlacklist } from '../entity/VouchBlacklist';
import { VouchVote } from '../entity/VouchVote';
import TicketHandler from './TicketHandler';

export default class VouchHandler {
    static readonly REQUIRED_VOUCHES = 3;
    static readonly APPROVAL_THRESHOLD = 1;
    static readonly REJECTION_THRESHOLD = 1;

    client: Bot;
    id: string;
    interaction: Interaction;

    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (id === 'vouch_submit' && interaction.isButton()) {
            this.showVouchModal(interaction as ButtonInteraction<'cached'>);
            return;
        }

        if (id.startsWith('vouch_submitModal') && interaction.isModalSubmit()) {
            this.handleVouchSubmit(interaction as ModalSubmitInteraction);
            return;
        }

        if (id === 'vouch_approve' && interaction.isButton()) {
            this.handleVote(interaction as ButtonInteraction<'cached'>, 'approve');
            return;
        }

        if (id === 'vouch_reject' && interaction.isButton()) {
            this.handleVote(interaction as ButtonInteraction<'cached'>, 'reject');
            return;
        }
    }

    //#region Vouch Submission

    private async showVouchModal(interaction: ButtonInteraction<'cached'>) {
        const modal = new ModalBuilder()
            .setCustomId(`vouch_submitModal_${interaction.user.id}`)
            .setTitle('Vouch for a User');

        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('vouch_user')
            .setRequired(true)
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('User to vouch for')
            .setUserSelectMenuComponent(userSelect)
        );

        const roleSelect = new StringSelectMenuBuilder()
            .setCustomId('vouch_role')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Elite 500').setValue('elite500'),
                new StringSelectMenuOptionBuilder().setLabel('Elite 1000').setValue('elite1000'),
                new StringSelectMenuOptionBuilder().setLabel('Elite 2000').setValue('elite2000'),
            ])
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('Elite role')
            .setStringSelectMenuComponent(roleSelect)
        );

        const rsnInput = new TextInputBuilder()
            .setCustomId('vouch_rsn')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addLabelComponents(label => label
            .setLabel('RSN')
            .setTextInputComponent(rsnInput)
        );

        const descriptionInput = new TextInputBuilder()
            .setCustomId('vouch_description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000);

        modal.addLabelComponents(label => label
            .setLabel('Describe how the hour went')
            .setTextInputComponent(descriptionInput)
        );

        await interaction.showModal(modal);
    }

    private async handleVouchSubmit(interaction: ModalSubmitInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const modalUserId = interaction.customId.split('_')[2];

        if (modalUserId !== interaction.user.id) {
            return await interaction.editReply('This modal is not for you.');
        }

        try {
            const selectedUsers = interaction.fields.getSelectedUsers('vouch_user');
            const roleKey = interaction.fields.getStringSelectValues('vouch_role')[0];
            const rsn = interaction.fields.getTextInputValue('vouch_rsn').trim();
            const description = interaction.fields.getTextInputValue('vouch_description').trim();

            if (!selectedUsers?.size) {
                return await interaction.editReply('Please select a user to vouch for.');
            }

            const targetUser = selectedUsers.first()!;

            const isBlacklisted = await this.client.dataSource.getRepository(VouchBlacklist)
                .findOne({ where: { userId: interaction.user.id } });

            if (isBlacklisted) {
                return await interaction.editReply('You are blacklisted from vouching.');
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userRoleIds = member.roles.cache.map(r => r.id);
            const rolePriority = this.client.util.getTrialTierPriority(roleKey);

            if (rolePriority === null) {
                return await interaction.editReply('Invalid role selected.');
            }

            if (!this.client.util.canVouchForTrialRole(userRoleIds, roleKey)) {
                return await interaction.editReply(`You must have ${this.client.roles[roleKey]} or higher to vouch for this role.`);
            }

            const vouchRepository = this.client.dataSource.getRepository(Vouch);

            const existingVouch = await vouchRepository.findOne({
                where: { voucher: interaction.user.id, vouchee: targetUser.id, role: roleKey, status: 'pending' }
            });

            if (existingVouch) {
                return await interaction.editReply(`You have already vouched for this user at ${this.client.roles[roleKey]}.`);
            }

            const vouch = vouchRepository.create({
                voucher: interaction.user.id,
                vouchee: targetUser.id,
                rsn,
                role: roleKey,
                description,
                status: 'pending'
            });
            await vouchRepository.save(vouch);

            const allVouchesForUser = await vouchRepository.find({
                where: { vouchee: targetUser.id, status: 'pending' }
            });

            const { qualifyingRole, qualifyingVouches } = this.findQualifyingRole(roleKey, allVouchesForUser);

            const vouchProgress = `${allVouchesForUser.filter(v => {
                const vouchPriority = this.client.util.getTrialTierPriority(v.role);
                return vouchPriority !== null && vouchPriority >= rolePriority;
            }).length}/${VouchHandler.REQUIRED_VOUCHES}`;

            await this.sendVouchLog(interaction, targetUser, roleKey, rsn, vouchProgress);

            if (qualifyingRole) {
                try {
                    await TicketHandler.createVouchTicket(this.client, interaction, targetUser, qualifyingRole, qualifyingVouches);
                } catch (error) {
                    await vouchRepository.remove(vouch);
                    this.client.logger.error({ message: 'Failed to create vouch ticket — vouch rolled back', error, handler: this.constructor.name });
                    return await interaction.editReply('Failed to create the vouch ticket. Your vouch has not been counted — please try again.');
                }
            }

            await interaction.editReply(`Vouch submitted for <@${targetUser.id}> - ${this.client.roles[roleKey]} (${vouchProgress} vouches)`);
        } catch (error) {
            this.client.logger.error({ message: 'Failed to handle vouch submission', error, handler: this.constructor.name });
            await interaction.editReply('Something went wrong while processing your vouch. Please try again.').catch(() => { });
        }
    }

    private findQualifyingRole(roleKey: string, allVouches: Vouch[]): { qualifyingRole: string | null; qualifyingVouches: Vouch[] } {
        for (const checkRole of this.client.util.getTrialQualificationRoleKeys(roleKey)) {
            const checkPriority = this.client.util.getTrialTierPriority(checkRole);
            if (checkPriority === null) continue;

            const qualifying = allVouches.filter(v => {
                const p = this.client.util.getTrialTierPriority(v.role);
                return p !== null && p >= checkPriority;
            });

            const hasExistingTicket = allVouches.some(v => v.ticketRole === checkRole);

            if (qualifying.length >= VouchHandler.REQUIRED_VOUCHES && !hasExistingTicket) {
                return { qualifyingRole: checkRole, qualifyingVouches: qualifying.slice(0, VouchHandler.REQUIRED_VOUCHES) };
            }
        }

        return { qualifyingRole: null, qualifyingVouches: [] };
    }

    private async sendVouchLog(interaction: ModalSubmitInteraction, targetUser: { id: string }, roleKey: string, rsn: string, vouchProgress: string) {
        if (!this.client.channelIds.vouchLog) return;

        try {
            const logChannel = await this.client.channels.fetch(this.client.channelIds.vouchLog) as TextChannel;
            const logEmbed = new EmbedBuilder()
                .setColor(this.client.color)
                .setTitle('Vouch Submitted')
                .addFields(
                    { name: 'Voucher', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Vouchee', value: `<@${targetUser.id}>`, inline: true },
                    { name: 'Role', value: this.client.roles[roleKey], inline: true },
                    { name: 'RSN', value: rsn, inline: true },
                    { name: 'Progress', value: vouchProgress, inline: true }
                )
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            this.client.logger.error({ message: 'Failed to send vouch log', error, handler: this.constructor.name });
        }
    }

    //#endregion

    //#region Vouch Voting

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

            const existingVote = await voteRepository.findOne({ where: { vouchId: firstVouch.id, voterId: interaction.user.id } });

            if (existingVote) {
                existingVote.vote = voteType;
                await voteRepository.save(existingVote);
            } else {
                await voteRepository.save(voteRepository.create({
                    vouchId: firstVouch.id,
                    voterId: interaction.user.id,
                    vote: voteType
                }));
            }

            const allVotes = await voteRepository.find({ where: { vouchId: firstVouch.id } });
            const approveCount = allVotes.filter(v => v.vote === 'approve').length;
            const rejectCount = allVotes.filter(v => v.vote === 'reject').length;

            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
            const voteFieldIndex = updatedEmbed.data.fields?.findIndex(f => f.name === 'Votes');
            if (voteFieldIndex !== undefined && voteFieldIndex !== -1 && updatedEmbed.data.fields) {
                updatedEmbed.data.fields[voteFieldIndex].value = `✅ ${approveCount} | ❌ ${rejectCount}`;
            }

            await interaction.message.edit({ embeds: [updatedEmbed] });

            if (rejectCount >= VouchHandler.REJECTION_THRESHOLD) {
                await this.rejectVouch(interaction, firstVouch);
            } else if (approveCount >= VouchHandler.APPROVAL_THRESHOLD) {
                await this.approveVouch(interaction, firstVouch);
            }
        } catch (error) {
            this.client.logger.error({ message: 'Failed to handle vouch vote', error, handler: this.constructor.name });
        }
    }

    //#endregion

    //#region Vouch Resolution

    private async approveVouch(interaction: ButtonInteraction<'cached'>, vouch: Vouch) {
        try {
            const vouchRepository = this.client.dataSource.getRepository(Vouch);
            const vouches = await vouchRepository.find({ where: { ticketChannelId: interaction.channel!.id } });

            const member = await interaction.guild?.members.fetch(vouch.vouchee);
            if (!member) return;

            const existingRoleIds = member.roles.cache.map((role) => role.id);
            const { addedRoleIds, removedRoleIds, addedRoleMentions, removedRoleMentions } = this.client.util.getTrialRoleTransition(existingRoleIds, vouch.role);
            const hasRoleChanges = addedRoleIds.length > 0 || removedRoleIds.length > 0;
            const exactRoleId = this.client.roleIds[vouch.role];
            const newlyEarnedTier = Boolean(exactRoleId && !existingRoleIds.includes(exactRoleId));

            if (removedRoleIds.length > 0) await member.roles.remove(removedRoleIds);
            if (addedRoleIds.length > 0) await member.roles.add(addedRoleIds);

            const roleObject = await interaction.guild?.roles.fetch(this.client.roleIds[vouch.role]);
            const roleColor = roleObject?.hexColor || this.client.color;

            let confirmationMessage: Message | null = null;
            let messageUrl = '';
            const confirmChannel = this.client.channelIds.achievements
                ? await this.client.channels.fetch(this.client.channelIds.achievements) as TextChannel : null;

            if (confirmChannel && newlyEarnedTier) {
                const msg = await confirmChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleColor)
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

                if (addedRoleMentions.length > 0) {
                    changeLines.push(`${addedRoleMentions.join(', ')} assigned to <@${vouch.vouchee}> via vouch by ${voucherList}.`);
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
                        addedRoleIds,
                        removedRoleIds,
                        announcementChannelId: confirmationMessage?.channelId ?? null,
                        announcementMessageId: confirmationMessage?.id ?? null
                    })
                    : null;

                await logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(roleColor)
                        .setDescription(changeLines.join('\n'))
                        .setTimestamp()],
                    components: roleAssignmentLog
                        ? [new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder().setCustomId(this.client.util.getRejectRoleAssignCustomId(roleAssignmentLog.id)).setLabel('Reject Approval').setStyle(ButtonStyle.Danger)
                        )]
                        : []
                });
            }

            await this.finalizeVouchDecision(interaction, vouches, 'approved');
        } catch (error) {
            this.client.logger.error({ message: 'Failed to approve vouch', error, handler: this.constructor.name });
        }
    }

    private async rejectVouch(interaction: ButtonInteraction<'cached'>, vouch: Vouch) {
        try {
            const vouchRepository = this.client.dataSource.getRepository(Vouch);
            const vouches = await vouchRepository.find({ where: { ticketChannelId: interaction.channel!.id } });

            await this.finalizeVouchDecision(interaction, vouches, 'rejected');
        } catch (error) {
            this.client.logger.error({ message: 'Failed to reject vouch', error, handler: this.constructor.name });
        }
    }

    private async finalizeVouchDecision(interaction: ButtonInteraction<'cached'>, vouches: Vouch[], status: 'approved' | 'rejected') {
        const vouchRepository = this.client.dataSource.getRepository(Vouch);

        for (const v of vouches) {
            v.status = status;
            await vouchRepository.save(v);
        }

        const isApproved = status === 'approved';
        const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Secondary)
        );

        await interaction.message.edit({
            embeds: [EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(isApproved ? 0x00ff00 : 0xff0000)
                .setTitle(`Elite Role Vouch - ${isApproved ? 'APPROVED' : 'REJECTED'}`)],
            components: [closeRow]
        });
    }

    //#endregion
}
