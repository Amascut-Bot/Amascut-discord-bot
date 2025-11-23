import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';

const streamersFilePath = path.join(process.cwd(), 'monitored-streamers.json');

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

export default class ListStreamers extends BotInteraction {
    get name(): string {
        return 'list-streamers';
    }

    get description(): string {
        return 'Lists all Twitch streamers currently being monitored for notifications.';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const streamers = await readStreamers();

        if (streamers.length === 0) {
            return interaction.editReply({ content: 'There are no streamers currently on the notification list.' });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${streamers.length} Monitored Twitch Streamers`)
            .setColor(this.client.color)
            .setTimestamp();

        const description = streamers
            .map(s => `• **${s.displayName}** (\`${s.userName}\`)`)
            .join('\n');

        embed.setDescription(description);

        await interaction.editReply({ embeds: [embed] });
    }
}
