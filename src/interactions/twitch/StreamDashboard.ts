import { SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';

export default class StreamDashboard extends BotInteraction {

    public get name(): string {
        return 'stream-dashboard';
    }

    public get description(): string {
        return 'Create the content creators dashboard embed';
    }

    public get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    public get permissions(): string {
        return 'OWNER';
    }

    public async run(interaction: any): Promise<void> {
        if (!interaction.inCachedGuild()) return;

        try {
            const twitchHandler = this.client.twitchHandler;
            if (!twitchHandler) {
                await interaction.reply({ content: 'Twitch handler not found.', ephemeral: true });
                return;
            }

            await (twitchHandler as any).updateContentCreatorsDashboard();

            await interaction.reply({ content: 'Content creators dashboard has been created/updated!', ephemeral: true });
        } catch (error) {
            console.error('Failed to create dashboard:', error);
            await interaction.reply({ content: 'Failed to create the dashboard. Check the logs for details.', ephemeral: true });
        }
    }
}
