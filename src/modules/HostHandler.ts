import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, UserSelectMenuInteraction } from 'discord.js';
import Bot from '../Bot';
import * as fs from 'fs';
import * as path from 'path';
import TicketHandler from './TicketHandler';
import ComponentsV2Utils from './ComponentsV2Utils';
import { HostParticipation } from '../entity/HostParticipation';

export default interface HostHandler { client: Bot; id: string; interaction: Interaction }

interface RoleIntersection {
    [key: string]: string[];
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

        if (id.startsWith("host_trial_finish_")) {
            this.handleHostFinishByType(interaction as ModalSubmitInteraction, id.substring(18), 2);
        }

        switch (id) {
            case 'host_learner_select_user': this.handleHostUserselectByType(interaction as UserSelectMenuInteraction, 0); break;
            case 'host_learner_select_role': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 0); break;
            case 'host_learner_select_type': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 0); break;
            case 'host_learner_submit_select': this.handleHostAssignByType(interaction, 0); break;
            case 'host_learner_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 0); break;
            case 'host_learner_disband': this.disbandHost(interaction, 0); break;
            case 'host_learner_quickfinish': this.quickFinishHost(interaction, 0); break;

            case 'host_lorebook_select_user': this.handleHostUserselectByType(interaction as UserSelectMenuInteraction, 1); break;
            case 'host_lorebook_select_role': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 1); break;
            case 'host_lorebook_select_type': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 1); break;
            case 'host_lorebook_submit_select': this.handleHostAssignByType(interaction, 1); break;
            case 'host_lorebook_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 1); break;
            case 'host_lorebook_disband': this.disbandHost(interaction, 1); break;
            case 'host_lorebook_quickfinish': this.quickFinishHost(interaction, 1); break;

            case 'host_trial_select_user': this.handleHostUserselectByType(interaction as UserSelectMenuInteraction, 2); break;
            case 'host_trial_select_role': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 2); break;
            case 'host_trial_select_type': this.handleHostStringselectByType(interaction as StringSelectMenuInteraction, 2); break;
            case 'host_trial_submit_select': this.handleHostAssignByType(interaction, 2); break;
            case 'host_trial_finish': this.finishHost(interaction as ButtonInteraction<'cached'>, 2); break;
            case 'host_trial_disband': this.disbandHost(interaction, 2); break;
            case 'host_trial_quickfinish': this.quickFinishHost(interaction, 2); break;
        }
    }

    //#region Modal Handlers

    private async handleHostFinishByType(interaction: ModalSubmitInteraction, hostMessageId: string, type: number) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // get current host card & clean it
        const message = await interaction.channel!.messages.fetch({
            limit: 1,
            before: interaction.message!.id
        });
        const container: ContainerBuilder = ComponentsV2Utils.cleanContainer(message!.first()!.components[0]);
        const controlContainer = ComponentsV2Utils.cleanContainer(interaction.message?.components[0]);

        let containerJson = JSON.stringify(container, null, 2);
        let controlContainerJson = JSON.stringify(controlContainer, null, 2);

        // give points
        const hostData = HostHandler.getHostData(containerJson);
        const hostData2 = HostHandler.getHostData(controlContainerJson);

        const users: string[] = (hostData[1] as string[]).map(x => x.slice(2, -1));
        const hosts: string[] = (hostData2[2] as string[]).map(x => x.slice(2, -1));
        const learners: string[] = (hostData2[3] as string[]).map(x => x.slice(2, -1));

        if (!users.includes(interaction.user.id)) {
            users.push(interaction.user.id);
        }

        // make sure users dont contain the learners
        const fillers = users.filter(x => !learners.includes(x) && !hosts.includes(x));

        if (type === 0 || type === 1) {
            for (let index = 0; index < learners.length; index++) {
                await HostHandler.saveHost(this.client, type, message?.first()?.url ?? null, hosts, fillers);
            }
        } else {
            await HostHandler.saveHost(this.client, type, message?.first()?.url ?? null, hosts, fillers);
        }

        // post summary
        const hostTypeLabel = type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book' : type === 2 ? 'Trial' : 'Undefined';
        const attendingTypeLabel = type === 0 ? 'Learners' : type === 1 ? 'Learners' : type === 2 ? 'Trialees' : 'Undefined';

        const summary = interaction.fields.getTextInputValue("summary");
        const summaryContainer = this.client.cv2.getContainerBuilder(null, `${hostTypeLabel} hosted by <@${interaction.user.id}> - Summary`);

        const teachersText = `### Hosts:\n${hosts.map(x => `<@${x}>`).join('\n')}`;
        const fillersText = `### Participants:\n${fillers.map(x => `<@${x}>`).join('\n')}`;
        const learnersText = `### ${attendingTypeLabel}:\n${learners.map(x => `<@${x}>`).join('\n')}`;

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

        // disable Host
        await HostHandler.disableHost(interaction.message!);

        await interaction.editReply('Learner hour finished!');
    }

    //#endregion

    //#region Signup Handlers

    private async handleHostUserselectByType(interaction: UserSelectMenuInteraction, type: number) {
        await interaction.deferUpdate();

        const userIds: string[] = interaction.values;
        const userIdSubmit: string = interaction.user.id;

        this.client.tempSubmissionData?.set(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_user_${userIdSubmit}`, userIds);
    }

    private async handleHostStringselectByType(interaction: StringSelectMenuInteraction, type: number) {
        await interaction.deferUpdate();

        const roles: string[] = interaction.values;
        const userIdSubmit: string = interaction.user.id;

        if (interaction.customId === `host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_select_role`) {
            this.client.tempSubmissionData?.set(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_role_${userIdSubmit}`, roles);
        } else if (interaction.customId === `host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_select_type`) {
            this.client.tempSubmissionData?.set(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_type_${userIdSubmit}`, roles);
        }
    }

    private async handleHostAssignByType(interaction: Interaction, type: number) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
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

        const container = ComponentsV2Utils.cleanContainer(interaction.message!.components[0]);

        //check submissionData
        const userIdSubmit: string = interaction.user.id;

        if (this.client.tempSubmissionData?.has(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_role_${userIdSubmit}`)
            && this.client.tempSubmissionData?.has(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_user_${userIdSubmit}`)
            && this.client.tempSubmissionData?.has(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_type_${userIdSubmit}`)) {
            const user = this.client.tempSubmissionData.get(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_user_${userIdSubmit}`)[0];
            const roles = this.client.tempSubmissionData.get(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_role_${userIdSubmit}`);
            const typeSelect = this.client.tempSubmissionData.get(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_type_${userIdSubmit}`)[0];

            // fetch previous message, that contains the host
            const message = await interaction.channel!.messages.fetch({
                limit: 1,
                before: interaction.message?.id
            });

            if (message) {
                for (const role of roles) {
                    await this.handleHostAssign(interaction, role, message.first()!, user);
                }

                let containerJson = JSON.stringify(container, null, 2);

                if (typeSelect === 'host' || typeSelect === 'learner') {
                    // update the control-panel
                    const containerData = HostHandler.getHostData(containerJson);
                    const data: Map<string, string> = containerData[0] as Map<string, string>;
                    const userMention: string = `<@${user}>`;

                    if (data.get(typeSelect)?.includes(userMention)) {
                        // remove teacher / learner from host
                        const oldValue = `${HostHandler.keyToLabel(typeSelect)}: ${data.get(typeSelect)}`.trim();
                        const newValue = oldValue.replace(userMention, '');
                        containerJson = containerJson.replace(oldValue, newValue);
                    } else {
                        // add teacher / learner to host
                        const oldValue = `${HostHandler.keyToLabel(typeSelect)}: ${data.get(typeSelect) ? data.get(typeSelect): ''}`.trim();
                        const newValue = `${oldValue} ${userMention}`;

                        //edge case: card CAN not contain a learner yet, but always has a host
                        if ((typeSelect === 'learner' && !containerJson.includes('Learner:'))
                            || (typeSelect === 'trialee' && !containerJson.includes('Trialee:'))
                         ) {
                            containerJson = containerJson.replace('Host:', `${newValue}\\nHost:`);
                        } else {
                            containerJson = containerJson.replace(oldValue, newValue);
                        }
                    }
                }

                const newContainer = JSON.parse(containerJson);

                const containers = [];
                containers.push(newContainer);

                // Reset Panel
                return await interaction.message!.edit({
                    components: containers,
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { 'parse': [] }
                });
            }
        }

        return interaction.editReply('You need to choose a role and user first!');
    }

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

        await message.edit({ components: containers, flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] }});
        return await interaction.editReply(reply);
    }

    //#endregion

    //#region Posting Handlers

    private async handleHostPostByType(interaction: Interaction, id: string, type: number) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
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

        //find from ticket
        const learner = await TicketHandler.findTicketOpener(interaction.channel as TextChannel, this.client);

        //grab hosts channel
        const hostChannel = type === 0 ? await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel
                            : type === 1 ? await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel
                            : type === 2 ? await interaction.guild?.channels.fetch(this.client.channelIds.trialHosts) as TextChannel
                            : await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel;

        //set up the host card in it
        await HostHandler.postHost(hostChannel!, id, null, learner ? [learner] : null, [interaction.user.id], null, type);

        return await interaction.editReply(`Host card successfully created! Head over to <#${hostChannel.id}> to find your host.`);
    }

    private async disbandHost(interaction: Interaction, type: number) {
        if (!('editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply();

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

    private async finishHost(interaction: ButtonInteraction<'cached'>, type: number) {
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
            .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_finish_${interaction.message.id}`)
            .setTitle('Summary');

        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addLabelComponents(label => label
            .setLabel('Please summarize the hour')
            .setTextInputComponent(summaryInput)
        );

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

        const modal = new ModalBuilder()
            .setCustomId('quickfinish-host-modal')
            .setTitle('finish host');

        // Hosts
        const hostSelect = new UserSelectMenuBuilder()
            .setCustomId('host_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who were hosting?').setUserSelectMenuComponent(hostSelect));

        // Fillers
        const fillerSelect = new UserSelectMenuBuilder()
            .setCustomId('filler_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who were participating?').setUserSelectMenuComponent(fillerSelect));

        // Fillers
        const learnerSelect = new UserSelectMenuBuilder()
            .setCustomId('learner_select')
            .setRequired(true)
            .setMaxValues(5);

        modal.addLabelComponents(label => label.setLabel('Who were learning / getting book / trialing?').setUserSelectMenuComponent(learnerSelect));

        // Summary
        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(4000);

        modal.addLabelComponents(label => label.setLabel('Summarize the hour').setTextInputComponent(summaryInput));

        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) => i.customId === 'quickfinish-host-modal' && i.user.id === interaction.user.id;

        try {
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 900_000 }); // 15 minutes

            const hostSelect = modalInteraction.fields.getSelectedUsers('host_select', true);
            const fillerSelect = modalInteraction.fields.getSelectedUsers('filler_select', true);
            const learnerSelect = modalInteraction.fields.getSelectedUsers('learner_select', true);
            const summaryInput = modalInteraction.fields.getTextInputValue('summary');

            const hostTypeLabel = type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book Kill' : type === 2 ? 'Trial' : 'Undefined';
            const attendingTypeLabel = type === 0 ? 'Learners' : type === 1 ? 'Learners' : type === 2 ? 'Trialees' : 'Undefined';

            const container = this.client.cv2.getContainerBuilder(null, `${hostTypeLabel} hosted by <@${interaction.user.id}> - Summary`);
            const hosts = `### Hosts:\n${hostSelect.map(x => `<@${x.id}>`).join('\n')}`;
            const hostsArray = hostSelect.map(x => x.id);
            const fillers = `### Participants:\n${fillerSelect.map(x => `<@${x.id}>`).join('\n')}`;
            const fillersArray = fillerSelect.map(x => x.id);
            const learners = `### ${attendingTypeLabel}:\n${learnerSelect.map(x => `<@${x.id}>`).join('\n')}`;
            const learnersArray = learnerSelect.map(x => x.id);

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
        const message = await hostMessage.channel!.messages.fetch({
            limit: 1,
            before: hostMessage.id
        });

        if (message) {
            // disable controls
            await ComponentsV2Utils.disableControls(message.first()!);
            await ComponentsV2Utils.disableControls(hostMessage);

            return true;
        }

        return false;
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
            "backupglyphs": ["glyphs"]
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
            default:
                return "";
        }
    }

    public static async postHost(channel: TextChannel, mode: string, message: string | null, users: string[] | null = null, hosts: string[] | null = null, time: string | null = null, type: number = -1): Promise<boolean> {
        const hostJson = this.loadHostConfig(mode, message);

        if (hostJson) {
            const hostContainer = JSON.parse(hostJson);

            await channel.send(
                { components: [hostContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } }
            );

            if (hosts !== null) {
                const teacherContainer = new ContainerBuilder()
                    .setAccentColor(10454367)
                    .addTextDisplayComponents(builder => builder.setContent(`${type === 0 ? 'Learner Hour' : type === 1 ? 'Lore Book Kill' : type === 2 ? 'Trial' : 'Undefined'} Control Panel`))
                    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                let text = '';

                if (time) text += `Time: <t:${time}:F>\n`;
                if (users) text += `${type === 0 ? 'Learner' : type === 1 ? 'Learner' : type === 2 ? 'Trialee' : 'Undefined'}: <@${users.join('>, <@')}>\n`;
                text += `Host: <@${hosts?.join('>, <@')}>`;

                teacherContainer.addTextDisplayComponents(builder => builder.setContent(text)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                // Disable Buttons:
                const finishButton = new ButtonBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_finish`)
                    .setLabel('Finish')
                    .setStyle(ButtonStyle.Success);

                const disbandButton = new ButtonBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_disband`)
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Danger);

                teacherContainer.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(finishButton, disbandButton)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                //doesnt work bc of 40 components limit
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_select_user`)
                    .setPlaceholder('Select a user to sign up');

                const roleOptions = [
                    new StringSelectMenuOptionBuilder().setLabel('Base').setValue('base'),
                    new StringSelectMenuOptionBuilder().setLabel('West in').setValue('westin'),
                    new StringSelectMenuOptionBuilder().setLabel('West out').setValue('westout'),
                    new StringSelectMenuOptionBuilder().setLabel('East in').setValue('eastin'),
                    new StringSelectMenuOptionBuilder().setLabel('East out').setValue('eastout'),
                    new StringSelectMenuOptionBuilder().setLabel('South Charge').setValue('southcharge'),
                    new StringSelectMenuOptionBuilder().setLabel('Solo Charge 1').setValue('solocharge1'),
                    new StringSelectMenuOptionBuilder().setLabel('Solo Charge 2').setValue('solocharge2'),
                    new StringSelectMenuOptionBuilder().setLabel('Dogs').setValue('dogs'),
                    new StringSelectMenuOptionBuilder().setLabel('Green 1').setValue('green1'),
                    new StringSelectMenuOptionBuilder().setLabel('Green 2').setValue('green2'),
                ];

                if (mode !== 'nm') {
                    roleOptions.push(new StringSelectMenuOptionBuilder().setLabel('Glyphs').setValue('glyphs'));

                    if (mode === '2000') {
                        roleOptions.push(new StringSelectMenuOptionBuilder().setLabel('Backup Glyphs').setValue('backupglyphs'));
                    } else {
                        roleOptions.push(new StringSelectMenuOptionBuilder().setLabel('Jumper').setValue('jumper'));
                    }
                }

                const roleSelect = new StringSelectMenuBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_select_role`)
                    .setPlaceholder('Select a role to sign the user up')
                    .addOptions(roleOptions)
                    .setMaxValues(5);

                const typeOptions = [
                    new StringSelectMenuOptionBuilder().setLabel('Host').setValue('host'),
                    new StringSelectMenuOptionBuilder().setLabel('Participant').setValue('filler'),
                    new StringSelectMenuOptionBuilder().setLabel(`${type === 0 ? 'Learner' : type === 1 ? 'Learner' : type === 2 ? 'Trialee' : 'Undefined'}`).setValue('learner'),
                ];

                const typeSelect = new StringSelectMenuBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_select_type`)
                    .setPlaceholder('Select a type to sign the user up')
                    .addOptions(typeOptions);

                teacherContainer.addActionRowComponents(new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect));
                teacherContainer.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect));
                teacherContainer.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect));

                const submitSelectButton = new ButtonBuilder()
                    .setCustomId(`host_${type === 0 ? 'learner' : type === 1 ? 'lorebook' : type === 2 ? 'trial' : 'undefined'}_submit_select`)
                    .setLabel('Submit Assign')
                    .setStyle(ButtonStyle.Primary);

                teacherContainer.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(submitSelectButton));

                await channel.send(
                    { components: [teacherContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } }
                );
            }

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
                config = config.replace("<message_placeholder>", message);
            }

            return config;
        } catch (error) {
            return null;
        }
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
