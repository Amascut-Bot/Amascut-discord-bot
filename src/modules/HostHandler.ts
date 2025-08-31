import { Interaction, MessageFlags, TextChannel } from 'discord.js';
import Bot from '../Bot';
import * as fs from 'fs';
import * as path from 'path';
import UtilityHandler from './UtilityHandler';

export default interface HostHandler { client: Bot; id: string; interaction: Interaction }

interface RoleIntersection {
    [key: string]: string[];
}

export default class HostHandler {
    constructor(client: Bot, id: string, interaction: Interaction) {
        this.client = client;
        this.id = id;
        this.interaction = interaction;

        if (id.startsWith("host_assign_")) {
            this.handleHostAssign(interaction, id.substring(12));
            return;
        }

        if (id.startsWith("host_post_")) {
            this.handleHostPost(interaction, id.substring(10));
            return;
        }

        switch (id) {

        }
    }

    //#region Signup Handlers

    private async handleHostAssign(interaction: Interaction, id: string) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = id.toLowerCase();
        const keyLabel = HostHandler.keyToLabel(key);

        if (keyLabel.length === 0) {
            return await interaction.editReply('something went wrong');
        }

        const userMention: string = `<@${interaction.user.id}>`;

        // get current host card & clean it
        const container = UtilityHandler.cleanContainer(interaction.message!.components[0]);
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
            const roleError = this.checkRole(data, userMention, key);
            if (roleError === null) {
                containerJson = containerJson.replace(`${keyLabel}: \`empty\``, `${keyLabel}: ${userMention}`);
                reply = `Successfully signed up as \`${keyLabel}\``;
            } else {
                return await interaction.editReply(`\`${keyLabel}\` is not combineable with \`${roleError}\``);
            }
        }

        const newContainer = JSON.parse(containerJson);
        await interaction.message!.edit({ components: [newContainer], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] }});
        return await interaction.editReply(reply);
    }

    private async handleHostPost(interaction: Interaction, id: string) {
        if (!('deferReply' in interaction && 'editReply' in interaction && 'message' in interaction)) {
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await HostHandler.postHost(interaction.channel! as TextChannel, id, null);

            return await interaction.editReply('Host card successfully created');
    }

    //#endregion

    //#region Static

    get roleCombinationBlacklist(): RoleIntersection {
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

    private checkRole(hostData: Map<string, string>, userMention: string, roleToCheck: string): string | null {
        const checkRoles: string[] = this.roleCombinationBlacklist[roleToCheck];

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

    public static async postHost(channel: TextChannel, mode: string, message: string | null): Promise<boolean> {
        const hostJson = this.loadHostConfig(mode, message);

        if (hostJson) {
            const hostContainer = JSON.parse(hostJson);

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
                config = config.replace("<message_placeholder>", message);
            }

            return config;
        } catch (error) {
            return null;
        }
    }

    //#endregion
}
