import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, SeparatorSpacingSize, StringSelectMenuBuilder, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from 'discord.js';
import Bot from '../Bot';
import * as uuid from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import TicketHandler from './TicketHandler';
import ComponentsV2Utils from './ComponentsV2Utils';
import { HostParticipation } from '../entity/HostParticipation';

export default interface HostHandler { client: Bot; id: string; interaction: Interaction }

interface RoleIntersection {
    [key: string]: string[];
}

interface TrialRoleContext {
    mode: string | null;
    targetRoleKey: string | null;
}

interface TrialPostContext {
    mode: string;
    targetRoleKey: string | null;
}

interface TrialFinishModalContext {
    hostMessageId: string;
    trialContext: TrialRoleContext | null;
}

export default class HostHandler {
    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (id.startsWith("host_assign_") && 'message' in interaction) {
            this.handleHostAssign(interaction, id.substring(12), interaction.message!);
            return;
        }

        if (id.startsWith("host_post_")) {
            this.handleHostPost(interaction, id.substring(10));
            return;
        }

        if (id.startsWith("host_learner_post_")) {
            this.handleHostPostByType(interaction, id.substring(18), 0);
            return;
        }

        if (id.startsWith("host_learner_finish_")) {
            this.handleHostFinishByType(interaction as ModalSubmitInteraction, id.substring(20), 0);
        }

        if (id.startsWith("host_lorebook_post_")) {
            this.handleHostPostByType(interaction, id.substring(19), 1);
            return;
        }

        if (id.startsWith("host_lorebook_finish_")) {
            this.handleHostFinishByType(interaction as ModalSubmitInteraction, id.substring(21), 1);
        }

        if (id.startsWith("host_trial_post_")) {
            this.handleHostPostByType(interaction, id.substring(16), 2);
            return;
        }

        if (id.startsWith("host_trial_finish_submit_")) {
            const trialFinishModalContext = HostHandler.parseTrialFinishModalContext(id);
            this.handleHostFinishByType(
                interaction as ModalSubmitInteraction,
                trialFinishModalContext?.hostMessageId ?? id.substring(25),
                2,
                trialFinishModalContext?.trialContext ?? null
            );
            return;
        }

        if (id.startsWith("host_trial_finish_") && interaction.isButton()) {
            this.finishHost(interaction as ButtonInteraction<'cached'>, 2, HostHandler.parseTrialFinishButtonContext(id));
            return;
        }

        switch (id) {
            case 'host_learner_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 0); break;
            case 'host_learner_disband': this.disbandHost(interaction, 0); break;
            case 'host_learner_quickfinish': this.quickFinishHost(interaction, 0); break;

            case 'host_lorebook_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 1); break;
            case 'host_lorebook_disband': this.disbandHost(interaction, 1); break;
            case 'host_lorebook_quickfinish': this.quickFinishHost(interaction, 1); break;

            case 'host_trial_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 2, null); break;
            case 'host_trial_disband': this.disbandHost(interaction, 2); break;
        }
    }

    //#region Modal Handlers

    private async handleHostFinishByType(interaction: ModalSubmitInteraction, hostMessageId: string, type: number, trialContext: TrialRoleContext | null = null) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const hostSelect = interaction.fields.getSelectedUsers('host_select', true);
        const fillerSelect = interaction.fields.getSelectedUsers('filler_select', true);
        const learnerSelect = interaction.fields.getSelectedUsers('learner_select', true);
        const summary = interaction.fields.getTextInputValue('summary');

        const trialPassSelection = type === 2 ? interaction.fields.getStringSelectValues('trial_pass_select')[0] : null;
        const pass = type === 2 ? trialPassSelection !== 'fail' : false;
        const selectedRoleKey = trialPassSelection?.startsWith('pass:') ? HostHandler.normalizeTrialRoleKey(trialPassSelection.substring(5)) : null;

        const hosts = hostSelect.map(x => x.id);
        const learners = learnerSelect.map(x => x.id);
        const fillers = fillerSelect.map(x => x.id).filter(x => !learners.includes(x) && !hosts.includes(x));
        let passResult: string | null = null;

        const message = interaction.message;
        const fallbackEnrage = trialContext?.mode && /^\d+$/.test(trialContext.mode) ? trialContext.mode : null;

        if (type === 0 || type === 1) {
            for (let index = 0; index < learners.length; index++) {
                await HostHandler.saveHost(this.client, type, message!.url ?? null, hosts, fillers);
            }
        } else {
            if (pass) {
                const trialee = await interaction.guild!.members.fetch(learners[0]);
                passResult = await this.passHost(
                    interaction.member as GuildMember,
                    trialee,
                    selectedRoleKey ?? trialContext?.targetRoleKey ?? null,
                    fallbackEnrage
                ) ?? null;
            }
            // recording fails is not necessary

            await HostHandler.saveHost(this.client, type, message!.url ?? null, hosts, fillers);
        }

        const hostTypeLabel = type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book' : type === 2 ? 'Trial' : 'Undefined';
        const attendingTypeLabel = type === 0 ? 'Learners' : type === 1 ? 'Learners' : type === 2 ? 'Trialees' : 'Undefined';

        const summaryContainer = this.client.cv2.getContainerBuilder(null, `${hostTypeLabel} hosted by <@${interaction.user.id}> - Summary`);

        const teachersText = `### Hosts:\n${hosts.map(x => `<@${x}>`).join('\n')}`;
        const fillersText = `### Participants:\n${fillers.map(x => `<@${x}>`).join('\n')}`;
        const learnersText = `### ${attendingTypeLabel}:\n${learners.map(x => `<@${x}>`).join('\n')}${type === 2 ? pass ? '(passed)' : '(failed)' : ''}`;

        summaryContainer.addTextDisplayComponents(t => t.setContent(teachersText))
            .addTextDisplayComponents(t => t.setContent(fillersText))
            .addTextDisplayComponents(t => t.setContent(learnersText))
            .addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));

        summaryContainer.addTextDisplayComponents(t => t.setContent(summary));

        const targetChannel = type === 0 ? await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel
            : type === 1 ? await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel
                : type === 2 ? await this.client.channels.fetch(this.client.channelIds.trialLounge) as TextChannel
                    : await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel;

        await targetChannel.send({
            components: [summaryContainer],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { "parse": [] }
        });

        await HostHandler.disableHost(interaction.message!);

        await interaction.editReply(type === 2 && passResult ? `${hostTypeLabel} finished! ${passResult}` : `${hostTypeLabel} finished!`);
    }

    //#endregion

    //#region Signup Handlers

    private async handleHostAssign(interaction: Interaction, id: string, message: Message<boolean>, user: string | null = null) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
            return;
        }

        if (!interaction.deferred) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const key = id.toLowerCase();
        const keyLabel = HostHandler.keyToLabel(key);

        if (keyLabel.length === 0) {
            return await interaction.editReply('something went wrong');
        }

        const userMention: string = `<@${user !== null ? user : interaction.user.id}>`;

        // get current host card & clean it
        const container = ComponentsV2Utils.cleanContainer(message.components[0]);

        let containerJson = JSON.stringify(container, null, 2);

        // extract data from current host
        const hostData = HostHandler.getHostData(containerJson);
        const data: Map<string, string> = hostData[0] as Map<string, string>;
        const users: string[] = hostData[1] as string[];

        if (users.length === 5 && !users.includes(userMention)) {
            return await interaction.editReply('This host is already full!');
        }

        // check if slot is taken
        if (data.get(key) !== '`empty`' && data.get(key) !== userMention) {
            return await interaction.editReply('This slot is already taken!');
        }

        let reply = '';
        // unassign
        if (data.get(key) === userMention) {
            containerJson = containerJson.replace(`${keyLabel}: ${userMention}`, `${keyLabel}: \`empty\``);
            reply = `Successfully removed signup as \`${keyLabel}\``;
        } else {
            // assign
            const roleError = HostHandler.checkRole(data, userMention, key);
            if (roleError === null) {
                containerJson = containerJson.replace(`${keyLabel}: \`empty\``, `${keyLabel}: ${userMention}`);
                reply = `Successfully signed up as \`${keyLabel}\``;
            } else {
                return await interaction.editReply(`\`${keyLabel}\` is not combineable with \`${roleError}\``);
            }
        }

        const newContainer = JSON.parse(containerJson);

        const containers = [];
        containers.push(newContainer);

        await message.edit({ components: containers, flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
        return await interaction.editReply(reply);
    }

    //#endregion

    //#region Posting Handlers

    private async handleHostPostByType(interaction: Interaction, id: string, type: number) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction && 'showModal' in interaction && 'awaitModalSubmit' in interaction)) {
            return;
        }

        const trialPostContext = type === 2 ? HostHandler.parseTrialPostContext(id) : null;
        const mode = trialPostContext?.mode ?? id;

        if (type === 0) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            //check if user is teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Teachers!');
            }
        }

        if (type === 1) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            //check if user is lore book crew, teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['lorebook', 'teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Lore Book Crew and Teachers!');
            }
        }

        if (type === 2) {
            //check if user is trial team, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction)) {
                return await interaction.reply('This action can only be used by Trial Team Members!');
            }
        }

        //find from ticket - if the interaction comes from a thread, resolve the parent channel
        const ticketChannel = interaction.channel?.isThread()
            ? await interaction.guild?.channels.fetch(interaction.channel.parentId!) as TextChannel
            : interaction.channel as TextChannel;
        const learner = await TicketHandler.findTicketOpener(ticketChannel, this.client);

        //grab hosts channel
        const hostChannel = type === 0 ? await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel
            : type === 1 ? await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel
                : type === 2 ? await interaction.guild?.channels.fetch(this.client.channelIds.trialHosts) as TextChannel
                    : await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel;
        const postChannel = type === 2
            ? interaction.channel as TextChannel
            : hostChannel!;

        let message: string | null = null;
        let targetRoleKey = trialPostContext?.targetRoleKey ?? null;

        if (type === 2 && !targetRoleKey) {
            return await interaction.reply('This trial host button is outdated. Close the ticket and create a fresh one before hosting the trial.');
        }

        if (type === 2) {
            // ask for time, trialee, and additional message
            const genid = `host-message-modal-${uuid.v4()}`
            let modalInteraction: ModalSubmitInteraction | null = null;

            const modal = new ModalBuilder()
                .setCustomId(genid)
                .setTitle('Create Host');

            // Trialee
            if (!learner) {
                const trialeeSelect = new UserSelectMenuBuilder()
                    .setCustomId('trialee_select')
                    .setRequired(false)
                    .setMaxValues(1);

                modal.addLabelComponents(label => label.setLabel('Who is the trialee? (optional)').setUserSelectMenuComponent(trialeeSelect));
            }

            // Time
            const timeInput = new TextInputBuilder()
                .setCustomId('time')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(100);

            modal.addLabelComponents(label => label.setLabel('When is the trial? (optional)').setTextInputComponent(timeInput));

            // Message
            const messageInput = new TextInputBuilder()
                .setCustomId('message')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(200);

            modal.addLabelComponents(label => label.setLabel('Additional Message (optional)').setTextInputComponent(messageInput));

            await interaction.showModal(modal);

            const filter = (i: ModalSubmitInteraction) => i.customId === genid && i.user.id === interaction.user.id;

            try {
                modalInteraction = await interaction.awaitModalSubmit({ filter, time: 900_000 }); // 15 minutes

                const trialeeSelect = !learner ? modalInteraction.fields.getSelectedUsers('trialee_select', false) : null;
                const timeInput = modalInteraction.fields.getTextInputValue('time');
                const messageInput = modalInteraction.fields.getTextInputValue('message');

                message = `Trial hosted by <@${interaction.user.id}>:
`;
                if (trialeeSelect && trialeeSelect.size > 0) {
                    message += `Trialee: <@${trialeeSelect.first()!.id}>
`;
                } else {
                    message += `Trialee: <@${learner}>
`;
                }

                if (timeInput) message += `Time: ${timeInput}
`;
                if (messageInput) message += `Message: ${messageInput}
`;

                message = message.trim();

                await HostHandler.postHost(postChannel, mode, message, learner ? [learner] : null, [interaction.user.id], null, type, targetRoleKey);

                return await modalInteraction.reply({ content: `Host card successfully created! Head over to <#${postChannel.id}> to find your host.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                if (modalInteraction) {
                    this.client.logger.error({ message: 'Trial host creation failed', error: err, handler: this.constructor.name });
                    if (modalInteraction.deferred || modalInteraction.replied) {
                        await modalInteraction.editReply({ content: 'Host creation failed. Please try again.' }).catch(() => { });
                    } else {
                        await modalInteraction.reply({ content: 'Host creation failed. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => { });
                    }
                }

                return;
            }
        }


        //set up the host card in it
        await HostHandler.postHost(postChannel, mode, message, learner ? [learner] : null, [interaction.user.id], null, type, targetRoleKey);

        return await interaction.editReply(`Host card successfully created! Head over to <#${postChannel.id}> to find your host.`);
    }

    private async disbandHost(interaction: Interaction, type: number) {
        if (!('editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (type === 0) {
            //check if user is teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Teachers!');
            }
        }

        if (type === 1) {
            //check if user is lore book crew, teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['lorebook', 'teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Lore Book Crew and Teachers!');
            }
        }

        if (type === 2) {
            //check if user is trial team, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Trial Team Members!');
            }
        }

        if (await HostHandler.disableHost(interaction.message!)) {
            return await interaction.editReply('Host was disbanded!');
        } else {
            return await interaction.editReply('Host could not be disbanded because the host message was not found!');
        }
    }

    private async passHost(host: GuildMember, member: GuildMember, targetRoleKey: string | null = null, fallbackEnrage: string | null = null): Promise<string | undefined> {
        const resolvedTargetRoleKey = targetRoleKey;
        const enrage = fallbackEnrage;
        const roleKey = this.client.util.resolveTrialAwardRole(member, resolvedTargetRoleKey, enrage);

        if (!roleKey) {
            return resolvedTargetRoleKey
                ? `Invalid target tier key: ${resolvedTargetRoleKey}.`
                : enrage
                    ? `Could not determine the exact trial tier for this ${enrage}% host. Choose the correct pass option or keep the trialee role on the member until the card is completed.`
                    : 'Could not determine the trial tier from the selected pass option or the trialee roles.';
        }

        try {
            const trialedRoleId = this.client.roleIds[roleKey];
            const existingRoleIds = member.roles.cache.map((role) => role.id);
            const rolePriority = this.client.util.getTrialTierPriority(roleKey);

            if (trialedRoleId && existingRoleIds.includes(trialedRoleId)) {
                return `<@${member.id}> already has ${this.client.roles[roleKey]}. No role changes were made.`;
            }

            if (rolePriority !== null && this.client.util.hasTrialRoleAbovePriority(existingRoleIds, rolePriority)) {
                return `<@${member.id}> already has a higher-priority role than ${this.client.roles[roleKey]}. No role changes were made.`;
            }

            const roleTransition = this.client.util.getTrialRoleTransition(existingRoleIds, roleKey);
            const rolesToAdd = roleTransition.addedRoleIds;
            const rolesToRemove = roleTransition.removedRoleIds;
            const grantedRoleMentions = roleTransition.addedRoleMentions;
            const removedRoleMentions = roleTransition.removedRoleMentions;
            const hasRoleChanges = rolesToAdd.length > 0 || rolesToRemove.length > 0;
            const newlyEarnedTier = Boolean(trialedRoleId && !existingRoleIds.includes(trialedRoleId));

            if (!trialedRoleId) {
                return `Could not resolve the roles to assign for ${roleKey}.`;
            }

            if (!hasRoleChanges) {
                return `<@${member.id}> already had every applicable role for ${this.client.roles[roleKey]}.`;
            }

            if (rolesToRemove.length > 0) {
                await member?.roles.remove(rolesToRemove);
            }

            if (rolesToAdd.length > 0) {
                await member?.roles.add(rolesToAdd);
            }

            const trialedRoleObject = await member.guild?.roles.fetch(trialedRoleId);
            const { colours } = this.client.util;

            const confirmationChannel = this.client.channelIds.achievements
                ? await this.client.channels.fetch(this.client.channelIds.achievements) as TextChannel
                : null;

            let confirmationMessage: Message | null = null;
            let messageUrl = '';
            if (confirmationChannel && newlyEarnedTier) {
                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: host.displayName,
                        iconURL: host.user.avatarURL() || undefined
                    })
                    .setTimestamp()
                    .setColor(trialedRoleObject?.hexColor || colours.discord.green)
                    .setDescription(`Congratulations to <@${member.id}> on achieving ${this.client.roles[roleKey]}!`);

                const message = await confirmationChannel.send({ embeds: [embed] });
                confirmationMessage = message;
                messageUrl = message.url;
            }

            const logChannelId = this.client.channelIds.roleAssignLogs;
            if (logChannelId) {
                const logChannel = await this.client.channels.fetch(logChannelId) as TextChannel;
                const changeLines: string[] = [];

                if (grantedRoleMentions.length > 0) {
                    changeLines.push(`${grantedRoleMentions.join(', ')} were assigned to <@${member.id}> by <@${host.user.id}>.`);
                }

                if (removedRoleMentions.length > 0) {
                    changeLines.push(`${removedRoleMentions.join(', ')} were removed from <@${member.id}>.`);
                }

                if (messageUrl) {
                    changeLines.push(`**Message**: ${messageUrl}`);
                }

                const roleAssignmentLog = await this.client.util.createRoleAssignmentLog({
                    targetUserId: member.id,
                    actorUserId: host.user.id,
                    source: 'host-pass',
                    addedRoleIds: rolesToAdd,
                    removedRoleIds: rolesToRemove,
                    announcementChannelId: confirmationMessage?.channelId ?? null,
                    announcementMessageId: confirmationMessage?.id ?? null
                });

                const logEmbed = new EmbedBuilder()
                    .setTimestamp()
                    .setColor(trialedRoleObject?.hexColor || colours.discord.green)
                    .setDescription(changeLines.join('\n'));

                const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(this.client.util.getRejectRoleAssignCustomId(roleAssignmentLog.id))
                            .setLabel('Reject Approval')
                            .setStyle(ButtonStyle.Danger)
                    );

                await logChannel.send({ embeds: [logEmbed], components: [buttonRow] });
            }

            const resultLines: string[] = [];

            if (grantedRoleMentions.length > 0) {
                resultLines.push(`${grantedRoleMentions.join(', ')} have been assigned to <@${member.id}>.`);
            }

            if (removedRoleMentions.length > 0) {
                resultLines.push(`${removedRoleMentions.join(', ')} have been removed from <@${member.id}>.`);
            }

            return resultLines.join(' ');
        } catch (err) {
            this.client.logger.error({ message: 'Pass host error:', error: err });
        }
    }

    private async finishHost(interaction: ButtonInteraction<'cached'>, type: number, trialContext: TrialRoleContext | null = null) {
        if (type === 0) {
            //check if user is teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Teachers!');
            }
        }

        if (type === 1) {
            //check if user is lore book crew, teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['lorebook', 'teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Lore Book Crew and Teachers!');
            }
        }

        if (type === 2) {
            //check if user is trial team, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Trial Team Members!');
            }
        }

        const modal = new ModalBuilder()
            .setCustomId(type === 2
                ? HostHandler.buildTrialFinishModalCustomId(interaction.message.id, trialContext)
                : `host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_finish_${interaction.message.id}`)
            .setTitle('Summary');

        const hostSelect = new UserSelectMenuBuilder()
            .setCustomId('host_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who was the host?').setUserSelectMenuComponent(hostSelect));

        const fillerSelect = new UserSelectMenuBuilder()
            .setCustomId('filler_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who participated?').setUserSelectMenuComponent(fillerSelect));

        const learnerSelect = new UserSelectMenuBuilder()
            .setCustomId('learner_select')
            .setRequired(true)
            .setMaxValues(5);

        if (type === 0) {
            modal.addLabelComponents(label => label.setLabel('Who was learning?').setUserSelectMenuComponent(learnerSelect));
        } else if (type === 1) {
            modal.addLabelComponents(label => label.setLabel('Who was getting the lorebook?').setUserSelectMenuComponent(learnerSelect));
        } else if (type === 2) {
            modal.addLabelComponents(label => label.setLabel('Who was the trialee?').setUserSelectMenuComponent(learnerSelect));

            const trialPassOptions = HostHandler.getTrialPassOptions(this.client, trialContext);
            const passSelect = new StringSelectMenuBuilder()
                .setCustomId('trial_pass_select')
                .setRequired(true)
                .setMaxValues(1)
                .addOptions(...trialPassOptions.options);

            modal.addLabelComponents(label => label.setLabel(trialPassOptions.label).setStringSelectMenuComponent(passSelect));
        }

        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        modal.addLabelComponents(label => label.setLabel('Summarise the hour').setTextInputComponent(summaryInput));

        await interaction.showModal(modal);
    }

    private async handleHostPost(interaction: Interaction, id: string) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (interaction.channel?.id === this.client.channelIds.learnerHosts) {
            //check if user is teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Teachers!');
            }
        }

        await HostHandler.postHost(interaction.channel! as TextChannel, id, null);

        return await interaction.editReply(`Host card successfully created! Head over to <#${interaction.channel!.id}> to find your host.`);
    }

    private async quickFinishHost(interaction: Interaction, type: number) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'showModal' in interaction && 'awaitModalSubmit' in interaction)) {
            return;
        }

        if (type === 0) {
            //check if user is teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Teachers!');
            }
        }

        if (type === 1) {
            //check if user is lore book crew, teacher, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['lorebook', 'teacher', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Lore Book Crew and Teachers!');
            }
        }

        if (type === 2) {
            //check if user is trial team, admin or owner
            if (!await this.client.util.hasRolePermissions(this.client, ['trialTeam', 'admin', 'owner'], interaction)) {
                return await interaction.editReply('This action can only be used by Trial Team Members!');
            }
        }

        const genid = uuid.v4()

        const modal = new ModalBuilder()
            .setCustomId(`quickfinish-host-modal-${genid}`)
            .setTitle('finish host');

        // Hosts
        const hostSelect = new UserSelectMenuBuilder()
            .setCustomId('host_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who was the host?').setUserSelectMenuComponent(hostSelect));

        // Fillers
        const fillerSelect = new UserSelectMenuBuilder()
            .setCustomId('filler_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who participated?').setUserSelectMenuComponent(fillerSelect));

        // Fillers
        const learnerSelect = new UserSelectMenuBuilder()
            .setCustomId('learner_select')
            .setRequired(true)
            .setMaxValues(5);

        if (type === 0) {
            modal.addLabelComponents(label => label.setLabel('Who was learning?').setUserSelectMenuComponent(learnerSelect));
        } else if (type === 1) {
            modal.addLabelComponents(label => label.setLabel('Who was getting the lorebook?').setUserSelectMenuComponent(learnerSelect));
        } else if (type === 2) {
            modal.addLabelComponents(label => label.setLabel('Who was the trialee?').setUserSelectMenuComponent(learnerSelect));
        }

        // Summary
        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        modal.addLabelComponents(label => label.setLabel('Summarise the hour').setTextInputComponent(summaryInput));

        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) => i.customId === `quickfinish-host-modal-${genid}` && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 900_000 }); // 15 minutes

            const hostSelect = modalInteraction.fields.getSelectedUsers('host_select', true);
            const fillerSelect = modalInteraction.fields.getSelectedUsers('filler_select', true);
            const learnerSelect = modalInteraction.fields.getSelectedUsers('learner_select', true);
            const summaryInput = modalInteraction.fields.getTextInputValue('summary');

            const hostTypeLabel = type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book Kill' : type === 2 ? 'Trial' : 'Undefined';
            const attendingTypeLabel = type === 0 ? 'Learners' : type === 1 ? 'Learners' : type === 2 ? 'Trialees' : 'Undefined';

            const container = this.client.cv2.getContainerBuilder(null, `${hostTypeLabel} hosted by <@${interaction.user.id}> - Summary`);

            const hostsArray = hostSelect.map(x => x.id);
            const hosts = `### Hosts:\n${hostsArray.map(x => `<@${x}>`).join('\n')}`;

            const learnersArray = learnerSelect.map(x => x.id);
            const learners = `### ${attendingTypeLabel}:\n${learnersArray.map(x => `<@${x}>`).join('\n')}`;

            const fillersArray = fillerSelect.map(x => x.id).filter(x => !learnersArray.includes(x) && !hostsArray.includes(x));
            const fillers = `### Participants:\n${fillersArray.map(x => `<@${x}>`).join('\n')}`;

            container.addTextDisplayComponents(t => t.setContent(hosts))
                .addTextDisplayComponents(t => t.setContent(fillers))
                .addTextDisplayComponents(t => t.setContent(learners))
                .addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));

            container.addTextDisplayComponents(t => t.setContent(summaryInput));

            // depending on type send summary to different channel
            const targetChannel = type === 0 ? await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel
                : type === 1 ? await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel
                    : type === 2 ? await this.client.channels.fetch(this.client.channelIds.trialLounge) as TextChannel
                        : await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel;

            await targetChannel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { "parse": [] }
            });

            if (type === 0 || type === 1) {
                for (let index = 0; index < learnersArray.length; index++) {
                    await HostHandler.saveHost(this.client, type, null, hostsArray, fillersArray);
                }
            } else {
                await HostHandler.saveHost(this.client, type, null, hostsArray, fillersArray);
            }

            await modalInteraction.reply({ content: `Host finished!`, flags: MessageFlags.Ephemeral });
        } catch (err) {
            console.error('quickFinishhost error:', err);
        }
    }

    //#endregion

    //#region Static

    private static parseTrialPostContext(id: string): TrialPostContext {
        const targetRoleKey = HostHandler.normalizeTrialRoleKey(id);
        const mode = targetRoleKey
            ? HostHandler.getModeFromTrialRoleKey(targetRoleKey)
            : id;

        return {
            mode,
            targetRoleKey
        };
    }

    private static normalizeTrialRoleKey(roleKey: string | null | undefined): string | null {
        const normalizedRoleKey = roleKey?.toLowerCase() ?? null;

        if (!normalizedRoleKey) {
            return null;
        }

        return /^(elite1000|elite2000|master1000|master2000)$/.test(normalizedRoleKey)
            ? normalizedRoleKey
            : null;
    }

    private static trialRoleKeyToLabel(roleKey: string): string {
        switch (roleKey) {
            case 'elite1000':
                return 'Elite 1000';
            case 'elite2000':
                return 'Elite 2000';
            case 'master1000':
                return 'Master 1000';
            case 'master2000':
                return 'Master 2000';
            default:
                return roleKey;
        }
    }

    private static getModeFromTrialRoleKey(roleKey: string): string {
        return roleKey.match(/(500|1000|2000)$/)?.[1] ?? 'nm';
    }

    private static buildTrialFinishButtonCustomId(mode: string, targetRoleKey: string | null): string {
        return `host_trial_finish_${mode}_${targetRoleKey ?? 'none'}`;
    }

    private static parseTrialFinishButtonContext(id: string): TrialRoleContext | null {
        if (!id.startsWith('host_trial_finish_')) {
            return null;
        }

        const rawContext = id.substring('host_trial_finish_'.length);
        const separatorIndex = rawContext.indexOf('_');

        if (separatorIndex === -1) {
            return {
                mode: rawContext.length > 0 ? rawContext : null,
                targetRoleKey: null
            };
        }

        const mode = rawContext.substring(0, separatorIndex);
        const rawTargetRoleKey = rawContext.substring(separatorIndex + 1);

        return {
            mode: mode.length > 0 ? mode : null,
            targetRoleKey: HostHandler.normalizeTrialRoleKey(rawTargetRoleKey === 'none' ? null : rawTargetRoleKey)
        };
    }

    private static buildTrialFinishModalCustomId(hostMessageId: string, trialContext: TrialRoleContext | null): string {
        return `host_trial_finish_submit_${hostMessageId}_${trialContext?.mode ?? 'none'}_${trialContext?.targetRoleKey ?? 'none'}`;
    }

    private static parseTrialFinishModalContext(id: string): TrialFinishModalContext | null {
        if (!id.startsWith('host_trial_finish_submit_')) {
            return null;
        }

        const rawContext = id.substring('host_trial_finish_submit_'.length);
        const parts = rawContext.split('_');

        if (parts.length < 3) {
            return null;
        }

        const [hostMessageId, mode, rawTargetRoleKey] = parts;

        return {
            hostMessageId,
            trialContext: {
                mode: mode === 'none' ? null : mode,
                targetRoleKey: HostHandler.normalizeTrialRoleKey(rawTargetRoleKey === 'none' ? null : rawTargetRoleKey)
            }
        };
    }

    private static getTrialPassOptions(client: Bot, trialContext: TrialRoleContext | null): { label: string, options: { label: string, value: string }[] } {
        if (trialContext?.targetRoleKey) {
            return {
                label: 'Did they pass or fail?',
                options: [
                    { label: 'Pass', value: 'pass' },
                    { label: 'Fail', value: 'fail' }
                ]
            };
        }

        const roleKeys = trialContext?.mode && /^\d+$/.test(trialContext.mode)
            ? client.util.trialHierarchy.filter(roleKey => roleKey.endsWith(trialContext.mode!))
            : [...client.util.trialHierarchy];

        return {
            label: roleKeys.length > 1
                ? 'Did they pass or fail? Choose the exact tier for this host card.'
                : 'Did they pass or fail?',
            options: [
                ...roleKeys.map(roleKey => ({
                    label: `Pass - ${HostHandler.trialRoleKeyToLabel(roleKey)}`,
                    value: `pass:${roleKey}`
                })),
                { label: 'Fail', value: 'fail' }
            ]
        };
    }

    private static buildTrialHostMessage(message: string | null, targetRoleKey: string | null): string | null {
        const parts: string[] = [];

        if (targetRoleKey) {
            parts.push(`Target trial tier: ${HostHandler.trialRoleKeyToLabel(targetRoleKey)}`);
        }

        if (message && message.length > 0) {
            parts.push(message);
        }

        return parts.length > 0 ? parts.join('\n') : null;
    }

    private static getHostData(hostJson: string) {
        // extract data from current host card
        const data = new Map<string, string>();
        const hosts: string[] = [];
        const learners: string[] = [];

        const regex = /([\w ]+):\s*(`empty`|<@!?[0-9]+>)\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?\s*(`empty`|<@!?[0-9]+>)?/g;
        for (const match of hostJson.matchAll(regex)) {
            let label = match[1].trim();
            const value = match[2].trim();
            const value2 = match[3]?.trim();
            const value3 = match[4]?.trim();
            const value4 = match[5]?.trim();
            const value5 = match[6]?.trim();

            if (label.startsWith('n')) label = label.substring(1);
            label = label.replaceAll(" ", "").toLowerCase();

            data.set(label, value);

            if (label === 'host') {
                if (!hosts.includes(value)) hosts.push(value);
                if (value2 && !hosts.includes(value2)) hosts.push(value2);
                if (value3 && !hosts.includes(value3)) hosts.push(value3);
                if (value4 && !hosts.includes(value4)) hosts.push(value4);
                if (value5 && !hosts.includes(value5)) hosts.push(value5);
            }

            if (label === 'learner' || label === 'trialee') {
                if (!learners.includes(value)) learners.push(value);
                if (value2 && !learners.includes(value2)) learners.push(value2);
                if (value3 && !learners.includes(value3)) learners.push(value3);
                if (value4 && !learners.includes(value4)) learners.push(value4);
                if (value5 && !learners.includes(value5)) learners.push(value5);
            }
        }

        // check if already 5 distinct people are signed up
        const users: string[] = [];

        for (const [_, entry] of data) {
            if (entry !== '`empty`') {
                if (!users.includes(entry)) {
                    users.push(entry);
                }
            }
        }

        return [data, users, hosts, learners];
    }

    private static async disableHost(hostMessage: Message<boolean>): Promise<boolean> {
        // disable controls
        //await ComponentsV2Utils.disableControls(message.first()!);
        //await ComponentsV2Utils.disableControls(hostMessage);
        await hostMessage.delete();

        return true;
    }

    static get roleCombinationBlacklist(): RoleIntersection {
        return {
            "base": ["westin", "westout", "eastin", "eastout"],
            "westin": ["base", "westout", "eastin", "eastout"],
            "westout": ["base", "westin", "eastin", "eastout"],
            "eastin": ["base", "westin", "westout", "eastout"],
            "eastout": ["base", "westin", "westout", "eastin"],
            "solocharge1": ["southcharge", "solocharge2", "green1", "green2", "dogs"],
            "solocharge2": ["southcharge", "solocharge1", "green1", "green2", "dogs"],
            "southcharge": ["solocharge1", "solocharge2", "green1", "green2"],
            "green1": ["southcharge", "solocharge1", "solocharge2", "green2", "dogs"],
            "green2": ["southcharge", "solocharge1", "solocharge2", "green1", "dogs"],
            "dogs": ["solocharge1", "solocharge2", "green1", "green2"],
            "jumper": ["glyphs"],
            "glyphs": ["jumper", "backupglyphs"],
            "backupglyphs": ["glyphs"],
            "necromancer": [],
        }
    }

    private static checkRole(hostData: Map<string, string>, userMention: string, roleToCheck: string): string | null {
        const checkRoles: string[] = HostHandler.roleCombinationBlacklist[roleToCheck];

        for (const checkRole of checkRoles) {
            if (hostData.has(checkRole) && hostData.get(checkRole) === userMention) {
                return HostHandler.keyToLabel(checkRole);
            }
        }

        return null;
    }

    private static keyToLabel(key: string): string {
        switch (key) {
            case "base":
                return "Base";
            case "westin":
                return "West in";
            case "westout":
                return "West out";
            case "eastin":
                return "East in";
            case "eastout":
                return "East out";
            case "solocharge1":
                return "Solo charge 1";
            case "solocharge2":
                return "Solo charge 2";
            case "southcharge":
                return "South charge";
            case "green1":
                return "Green 1";
            case "green2":
                return "Green 2";
            case "dogs":
                return "Dogs";
            case "jumper":
                return "Jumper";
            case "glyphs":
                return "Glyphs";
            case "backupglyphs":
                return "Backup Glyphs";
            case "host":
                return "Host";
            case "learner":
                return "Learner";
            case "trialee":
                return "Trialee";
            case "participant":
                return "Participant";
            case "necromancer":
                return "Necromancer";
            default:
                return "";
        }
    }

    public static async postHost(channel: TextChannel, mode: string, message: string | null, users: string[] | null = null, hosts: string[] | null = null, time: string | null = null, type: number = -1, targetRoleKey: string | null = null): Promise<boolean> {
        const hostMessage = type === 2
            ? HostHandler.buildTrialHostMessage(message, targetRoleKey)
            : message;

        const hostJson = this.loadHostConfig(mode, hostMessage);

        if (hostJson) {
            const hostContainer = JSON.parse(hostJson);

            if (hosts !== null) {
                const typeLabel = type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined';

                const buttons: ButtonBuilder[] = [];

                const finishButton = new ButtonBuilder()
                    .setCustomId(type === 2
                        ? HostHandler.buildTrialFinishButtonCustomId(mode, targetRoleKey)
                        : `host_${typeLabel}_finish`)
                    .setLabel('Finish')
                    .setStyle(ButtonStyle.Primary);

                const disbandButton = new ButtonBuilder()
                    .setCustomId(`host_${typeLabel}_disband`)
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Secondary);

                buttons.push(finishButton, disbandButton);

                const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

                if (hostContainer.components) {
                    hostContainer.components.push({ type: 14, spacing: 1 });
                    hostContainer.components.push(actionRow.toJSON());
                }
            }

            await channel.send(
                { components: [hostContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } }
            );

            return true;
        } else {
            return false;
        }
    }

    private static loadHostConfig(mode: string, message: string | null): string | null {
        try {
            let filename = "";

            switch (mode) {
                case "nm":
                    filename = "normal_mode";
                    break;
                case "100":
                case "500":
                case "750":
                case "1000":
                    filename = "enrage_mode_sub_2000";
                    break;
                case "2000":
                    filename = "enrage_mode_2000";
                    break;
                default:
                    filename = "normal_mode";
                    break;
            }

            if (message && message?.length > 0) {
                filename += "_msg";
            }

            const configPath = path.join(process.cwd(), `host_templates/${filename}.json`);
            let config = fs.readFileSync(configPath, 'utf8');

            config = config.replace("<enrage_placeholder>", mode);

            if (message && message?.length > 0) {
                config = config.replace("<message_placeholder>", HostHandler.escapeJsonString(message));
            }

            return config;
        } catch (error) {
            return null;
        }
    }

    private static escapeJsonString(value: string): string {
        return JSON.stringify(value).slice(1, -1);
    }

    //#endregion

    //#region Database

    public static async saveHost(client: Bot, type: number, link: string | null, hosts: string[], participants: string[]): Promise<void> {
        const { dataSource } = client;
        const hostParticipationRepository = dataSource.getRepository(HostParticipation);

        const hostParticipants: HostParticipation[] = [];

        // add all hosts
        for (const host of hosts) {
            const hostParticipation = new HostParticipation();
            hostParticipation.host = 1;
            hostParticipation.participate = 1;
            if (link) hostParticipation.link = link;
            hostParticipation.type = type;
            hostParticipation.user = host;
            hostParticipants.push(hostParticipation);
        }

        // add all fillers
        for (const filler of participants) {
            if (hosts.some(x => x === filler)) {
                continue;
            }
            const hostParticipation = new HostParticipation();
            hostParticipation.host = 0;
            hostParticipation.participate = 1;
            if (link) hostParticipation.link = link;
            hostParticipation.type = type;
            hostParticipation.user = filler;
            hostParticipants.push(hostParticipation);
        }

        await hostParticipationRepository.save(hostParticipants);
    }

    //#endregion
}
