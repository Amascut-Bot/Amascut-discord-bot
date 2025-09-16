import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ContainerBuilder, Interaction, Message, MessageFlags, ModalBuilder, ModalSubmitInteraction, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextChannel, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, UserSelectMenuInteraction } from 'discord.js';
import Bot from '../Bot';
import * as fs from 'fs';
import * as path from 'path';
import TicketHandler from './TicketHandler';
import ComponentsV2Utils from './ComponentsV2Utils';
import { LearnerHour } from '../entity/LearnerHour';
import { LearnerHourParticipation } from '../entity/LearnerHourParticipation';

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

        if (id.startsWith("host_learner_post_")) {
            this.handleLearnerHostPost(interaction, id.substring(18));
            return;
        }

        if (id.startsWith("host_post_")) {
            this.handleHostPost(interaction, id.substring(10));
            return;
        }

        if (id.startsWith("host_learner_finish_")) {
            this.handleHostLearnerFinish(interaction as ModalSubmitInteraction, id.substring(20));
        }

        switch (id) {
            case 'host_learner_select_user': this.handleLearnerHostUserselect(interaction as UserSelectMenuInteraction); break;
            case 'host_learner_select_role': this.handleLearnerHostStringselect(interaction as StringSelectMenuInteraction); break;
            case 'host_learner_submit_select': this.handleLearnerHostAssign(interaction); break;
            case 'host_learner_finish': this.finishHost(interaction as ButtonInteraction<'cached'>); break;
            case 'host_learner_disband': this.disbandHost(interaction); break;
        }
    }

    //#region Modal Handlers

    private async handleHostLearnerFinish(interaction: ModalSubmitInteraction, hostMessageId: string) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        // disable Host
        await HostHandler.disableHost(interaction.message!);

        // get current host card & clean it
        const message = await interaction.channel!.messages.fetch({
            limit: 1,
            before: interaction.message!.id
        });
        const container = ComponentsV2Utils.cleanContainer(message!.first()!.components[0]);

        let containerJson = JSON.stringify(container, null, 2);

        // give points
        const hostData = HostHandler.getHostData(containerJson);
        const users: string[] = (hostData[1] as string[]).map(x => x.slice(2, -1));

        if (!users.includes(interaction.user.id)) {
            users.push(interaction.user.id);
        }

        await this.saveLearnerHour(message!.first()!.url, interaction.user.id, users);

        // post summary in #teachers-chat
        const summary = interaction.fields.getTextInputValue("summary");
        const participants = `## Participants:\n${users.map(x => `<@${x}>`).join('\n')}`;

        const summaryContainer = this.client.cv2.getContainerBuilder(null, `Learner Hour hosted by <@${interaction.user.id}> - Summary`);
        summaryContainer.addTextDisplayComponents(t => t.setContent(participants)).addSeparatorComponents(s => s.setSpacing(SeparatorSpacingSize.Small));
        summaryContainer.addTextDisplayComponents(t => t.setContent(summary));

        const teacherChannel = await this.client.channels.fetch(this.client.channelIds.teachersChat) as TextChannel;
        await teacherChannel.send({
            components: [summaryContainer],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { "parse": [] }
        });

        await interaction.editReply('Learner hour finished!');
    }

    //#endregion

    //#region Signup Handlers

    private async handleLearnerHostUserselect(interaction: UserSelectMenuInteraction) {
        await interaction.deferUpdate();

        const userIds: string[] = interaction.values;
        const userIdSubmit: string = interaction.user.id;

        this.client.tempSubmissionData?.set(`host_learner_user_${userIdSubmit}`, userIds);
    }

    private async handleLearnerHostStringselect(interaction: StringSelectMenuInteraction) {
        await interaction.deferUpdate();

        const roles: string[] = interaction.values;
        const userIdSubmit: string = interaction.user.id;

        this.client.tempSubmissionData?.set(`host_learner_role_${userIdSubmit}`, roles);
    }

    private async handleLearnerHostAssign(interaction: Interaction) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        //check if user is teacher, admin or owner
        if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
            return await interaction.editReply('This action can only be used by Teachers!');
        }

        const container = ComponentsV2Utils.cleanContainer(interaction.message!.components[0]);

        //check submissionData
        const userIdSubmit: string = interaction.user.id;

        if (this.client.tempSubmissionData?.has(`host_learner_role_${userIdSubmit}`) && this.client.tempSubmissionData?.has(`host_learner_user_${userIdSubmit}`)) {
            const user = this.client.tempSubmissionData.get(`host_learner_user_${userIdSubmit}`)[0];
            const role = this.client.tempSubmissionData.get(`host_learner_role_${userIdSubmit}`)[0];

            // fetch previous message, that contains the host
            const message = await interaction.channel!.messages.fetch({
                limit: 1,
                before: interaction.message?.id
            });

            if (message) {
                await this.handleHostAssign(interaction, role, message.first()!, user);

                // Reset Panel
                return await interaction.message!.edit({
                    components: [container],
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

    private async handleLearnerHostPost(interaction: Interaction, id: string) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        //check if user is teacher, admin or owner
        if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
            return await interaction.editReply('This action can only be used by Teachers!');
        }

        //find learner from learner ticket
        const learner = await TicketHandler.findTicketOpener(interaction.channel as TextChannel, this.client);

        //grab learner hosts channel
        const learnerHostChannel = await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel;

        //set up the host card in it
        await HostHandler.postHost(learnerHostChannel!, id, null, learner, interaction.user.id);

        return await interaction.editReply('Host card successfully created');
    }

    private async disbandHost(interaction: Interaction) {
        if (!('editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply();

        //check if user is teacher, admin or owner
        if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
            return await interaction.editReply('This action can only be used by Teachers!');
        }

        if (await HostHandler.disableHost(interaction.message!)) {
            return await interaction.editReply('Host was disbanded!');
        } else {
            return await interaction.editReply('Host could not be disbanded because the host message was not found!');
        }
    }

    private async finishHost(interaction: ButtonInteraction<'cached'>) {
        //check if user is teacher, admin or owner
        if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
            return await interaction.reply('This action can only be used by Teachers!');
        }

        const modal = new ModalBuilder()
            .setCustomId(`host_learner_finish_${interaction.message.id}`)
            .setTitle('Learner Hour Summary');

        const summaryInput = new TextInputBuilder()
            .setCustomId('summary')
            .setLabel('Please summarize the learner hour')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(summaryInput);

        modal.addComponents(firstRow);
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

        return await interaction.editReply('Host card successfully created');
    }

    //#endregion

    //#region Static

    private static getHostData(hostJson: string) {
        // extract data from current host card
        const data = new Map<string, string>();
        const regex = /([\w ]+):\s*(`empty`|<@!?[0-9]+>)(?:\s*&\s*(`empty`|<@!?[0-9]+>))*/g;
        for (const match of hostJson.matchAll(regex)) {
            let label = match[1].trim();
            const value = match[2].trim();

            if (label.startsWith('n')) label = label.substring(1);
            label = label.replaceAll(" ", "").toLowerCase();

            data.set(label, value);
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

        return [data, users];
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
            default:
                return "";
        }
    }

    public static async postHost(channel: TextChannel, mode: string, message: string | null, user: string | null = null, host: string | null = null, time: string | null = null): Promise<boolean> {
        const hostJson = this.loadHostConfig(mode, message);

        if (hostJson) {
            const hostContainer = JSON.parse(hostJson);

            await channel.send(
                { components: [hostContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } }
            );

            if (host !== null) {
                const teacherContainer = new ContainerBuilder()
                    .setAccentColor(10454367)
                    .addTextDisplayComponents(builder => builder.setContent('Learner Hour Control Panel'))
                    .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                let text = '';

                if (time) text += `**Time:** <t:${time}:F>\n`;
                if (user) text += `**Learner:** <@${user}>\n`;
                text += `**Host:** <@${host}>`;

                teacherContainer.addTextDisplayComponents(builder => builder.setContent(text)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                // Disable Buttons:
                const finishButton = new ButtonBuilder()
                    .setCustomId('host_learner_finish')
                    .setLabel('Finish')
                    .setStyle(ButtonStyle.Success);

                const disbandButton = new ButtonBuilder()
                    .setCustomId('host_learner_disband')
                    .setLabel('Disband')
                    .setStyle(ButtonStyle.Danger);

                teacherContainer.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(finishButton, disbandButton)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

                //doesnt work bc of 40 components limit
                const userSelect = new UserSelectMenuBuilder()
                    .setCustomId('host_learner_select_user')
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
                    .setCustomId('host_learner_select_role')
                    .setPlaceholder('Select a role to sign the user up')
                    .addOptions(roleOptions);

                teacherContainer.addActionRowComponents(new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect));
                teacherContainer.addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect));

                const submitSelectButton = new ButtonBuilder()
                    .setCustomId('host_learner_submit_select')
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

    //#region Learners

    private async saveLearnerHour(link: string, host: string, participants: string[]): Promise<void> {
        const { dataSource } = this.client;
        const learnerHourRepository = dataSource.getRepository(LearnerHour);
        const learnerHourParticipationRepository = dataSource.getRepository(LearnerHourParticipation);

        const learnerHour = new LearnerHour();
        learnerHour.host = host;
        learnerHour.link = link;

        // add all participants
        const learnerHourParticipants: LearnerHourParticipation[] = [];
        for (const participant of participants) {
            const learnerHourParticipation = new LearnerHourParticipation();
            learnerHourParticipation.participant = participant;
            learnerHourParticipation.learnerHour = learnerHour;
            learnerHourParticipants.push(learnerHourParticipation);
        }

        // if host is not in list, add them aswell
        if (!participants.includes(host)) {
            const learnerHourParticipation = new LearnerHourParticipation();
            learnerHourParticipation.participant = host;
            learnerHourParticipation.learnerHour = learnerHour;
            learnerHourParticipants.push(learnerHourParticipation);
        }

        learnerHour.participants = learnerHourParticipants;

        await learnerHourRepository.save(learnerHour);
        await learnerHourParticipationRepository.save(learnerHourParticipants);
    }

    //#endregion

    //#region Trials
    //#endregion

    //#endregion
}
