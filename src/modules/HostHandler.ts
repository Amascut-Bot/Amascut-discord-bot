import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, Interaction, Message, MessageFlags, SeparatorSpacingSize, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, TextChannel, UserSelectMenuBuilder, UserSelectMenuInteraction } from 'discord.js';
import Bot from '../Bot';
import * as fs from 'fs';
import * as path from 'path';
import UtilityHandler from './UtilityHandler';
import TicketHandler from './TicketHandler';

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

        switch (id) {
            case 'host_learner_select_user': this.handleLearnerHostUserselect(interaction as UserSelectMenuInteraction); break;
            case 'host_learner_select_role': this.handleLearnerHostStringselect(interaction as StringSelectMenuInteraction); break;
            case 'host_learner_submit_select': this.handleLearnerHostAssign(interaction); break;
            case 'host_learner_finish': this.finishHost(interaction); break;
            case 'host_learner_disband': this.disbandHost(interaction); break;
        }
    }

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

        const container = UtilityHandler.cleanContainer(interaction.message!.components[0]);

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
        const container = UtilityHandler.cleanContainer(message.components[0]);

        let containerJson = JSON.stringify(container, null, 2);

        // extract data from current host card
        const data = new Map<string, string>();
        const regex = /([\w ]+):\s*(`empty`|<@!?[0-9]+>)(?:\s*&\s*(`empty`|<@!?[0-9]+>))*/g;
        for (const match of containerJson.matchAll(regex)) {
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

        const container = UtilityHandler.cleanContainer(interaction.message!.components[0], true);

        const message = await interaction.channel!.messages.fetch({
            limit: 1,
            before: interaction.message?.id
        });

        if (message) {
            const hostContainer = UtilityHandler.cleanContainer(message.first()!.components[0], true);
            await message.first()!.edit({
                components: [hostContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { 'parse': [] }
            });

            // Edit Panel
            await interaction.message!.edit({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { 'parse': [] }
            });

            return await interaction.editReply('Host was disbanded!');
        }

        return await interaction.editReply('Host could not be disbanded because the host message was not found!');
    }

    private async finishHost(interaction: Interaction) {
        if (!('editReply' in interaction)) {
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        //check if user is teacher, admin or owner
        if (!await this.client.util.hasRolePermissions(this.client, ['teacher', 'admin', 'owner'], interaction)) {
            return await interaction.editReply('This action can only be used by Teachers!');
        }

        return await interaction.editReply('Finish Host is without function atm :(.');
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
}
