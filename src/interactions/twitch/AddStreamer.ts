import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';
import { getRoles, getChannels } from '../../GuildSpecifics';

const streamersFilePath = path.join(process.cwd(), 'monitored-streamers.json');
const contentCreatorRoleId = getRoles(process.env.GUILD_ID).CONTENT_CREATOR_ROLE;

interface MonitoredStreamer {
    id: string;
    userName: string;
    displayName: string;
    discordUserId: string | null;
    profileImageUrl: string;
    isLive: boolean;
    lastLiveAt: Date | null;
}

async function readStreamers(): Promise<MonitoredStreamer[]> {
    try {
        await fs.access(streamersFilePath);
        const data = await fs.readFile(streamersFilePath, 'utf-8');
        return JSON.parse(data) as MonitoredStreamer[];
    } catch (error) {
        return [];
    }
}

async function writeStreamers(data: MonitoredStreamer[]): Promise<void> {
    await fs.writeFile(streamersFilePath, JSON.stringify(data, null, 2));
}

export default class AddStreamer extends BotInteraction {
    get name(): string {
        return 'add-streamer';
    }

    get description(): string {
        return 'Adds a Twitch streamer to the notification list.';
    }

    get permissions(): string {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('The Twitch username to add.')
                    .setRequired(true))
            .addUserOption(option =>
                option.setName('discord-user')
                    .setDescription('The Discord user to grant the "Live" role to.')
                    .setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        let userName = interaction.options.getString('username', true).toLowerCase();
        const discordUser = interaction.options.getUser('discord-user', true);

        const user = await interaction.guild?.members.fetch(discordUser.id);
        const userRoles = await user?.roles.cache.map(role => role.id) || [];

        const match = userName.match(/\/([^\/]+)\/?$/);
        if (match) {
            userName = match[1];
        }

        const streamerInfo = await this.client.twitchHandler.getStreamerInfo(userName);

        if (!streamerInfo) {
            return interaction.editReply({ content: `Could not find a Twitch user with the username \`${userName}\`. Please check the spelling.` });
        }

        const streamers = await readStreamers();

        if (streamers.some(s => s.id === streamerInfo.id)) {
            return interaction.editReply({ content: `**${streamerInfo.display_name}** is already on the notification list.` });
        }

        if (!userRoles.includes(contentCreatorRoleId)) {
            user?.roles.add(contentCreatorRoleId);
        }

        const newStreamer: MonitoredStreamer = {
            id: streamerInfo.id,
            userName: streamerInfo.login,
            displayName: streamerInfo.display_name,
            discordUserId: discordUser.id,
            profileImageUrl: streamerInfo.profile_image_url,
            isLive: false,
            lastLiveAt: null
        };

        streamers.push(newStreamer);
        await writeStreamers(streamers);

        this.client.logger.log({
            message: `Added streamer ${streamerInfo.display_name} to the notification list. Linked to ${discordUser.tag}`,
            user: interaction.user.username,
            handler: this.constructor.name
        }, true);

        await interaction.editReply({ content: `Successfully added **${streamerInfo.display_name}** to the notification list. Linked to **${discordUser.tag}**.` });
    }
}
