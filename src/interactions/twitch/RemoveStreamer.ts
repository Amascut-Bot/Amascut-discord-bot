import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";
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

async function writeStreamers(data: MonitoredStreamer[]): Promise<void> {
    await fs.writeFile(streamersFilePath, JSON.stringify(data, null, 2));
}

export default class RemoveStreamer extends BotInteraction {
    get name(): string {
        return 'remove-streamer';
    }

    get description(): string {
        return 'Removes a Twitch streamer from the notification list.';
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
                    .setDescription('The Twitch username to remove.')
                    .setRequired(true)
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();
        const streamers = await readStreamers();
        const choices = streamers.map(s => ({ name: s.displayName, value: s.userName }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ ephemeral: true });

        const userNameToRemove = interaction.options.getString('username', true);

        const streamers = await readStreamers();
        const initialLength = streamers.length;

        const newStreamers = streamers.filter(s => s.userName.toLowerCase() !== userNameToRemove.toLowerCase());

        if (newStreamers.length === initialLength) {
            return interaction.editReply({ content: `Could not find a streamer with the username \`${userNameToRemove}\` on the notification list.` });
        }

        await writeStreamers(newStreamers);

        this.client.logger.log({
            message: `Removed streamer ${userNameToRemove} from the notification list.`,
            user: interaction.user.username,
            handler: this.constructor.name
        }, true);

        await interaction.editReply({ content: `Successfully removed **${userNameToRemove}** from the notification list.` });
    }
}
