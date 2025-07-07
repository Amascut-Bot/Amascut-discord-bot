import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const notificationsFilePath = path.join(process.cwd(), 'notifications.json');

interface NotificationsData {
    [name: string]: any;
}

async function readNotificationsFile(): Promise<NotificationsData> {
    try {
        await fs.access(notificationsFilePath);
        const data = await fs.readFile(notificationsFilePath, 'utf-8');
        return JSON.parse(data) as NotificationsData;
    } catch (error) {
        return {};
    }
}

export default class DeleteNotification extends BotInteraction {
    get name() {
        return 'deletenotif';
    }

    get description() {
        return 'Deletes a notification template.';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('notification_name')
                    .setDescription('The name of the notification to delete.')
                    .setRequired(true)
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();
        const notifications = await readNotificationsFile();
        const choices = Object.keys(notifications);

        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedValue.toLowerCase()));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    }

    async run(interaction: ChatInputCommandInteraction) {
        const notificationName = interaction.options.getString('notification_name', true);
        
        try {
            const notifications = await readNotificationsFile();
            
            if (!notifications[notificationName]) {
                await interaction.reply({ content: `A notification template with the name "${notificationName}" does not exist.`, ephemeral: true });
                return;
            }

            delete notifications[notificationName];
            await fs.writeFile(notificationsFilePath, JSON.stringify(notifications, null, 4));

            await interaction.reply({ content: `Successfully deleted the notification template: **${notificationName}**.`, ephemeral: true });

        } catch (error) {
            this.client.logger.error({ message: 'Failed to delete notification template.', error: (error as Error).stack });
            await interaction.reply({ content: 'An error occurred while deleting the notification template.', ephemeral: true });
        }
    }
} 