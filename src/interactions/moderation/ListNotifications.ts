import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import * as fs from 'fs/promises';
import * as path from 'path';

const notificationsFilePath = path.join(process.cwd(), 'notifications.json');

interface Notification {
    target: string;
    pingRoleId: string | null;
    embed: {
        title?: string;
        description?: string;
        footer?: string;
        image?: string;
        thumbnail?: string;
    }
}

interface NotificationsData {
    [name: string]: Notification;
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

export default class ListNotifications extends BotInteraction {
    get name() {
        return 'listnotif';
    }

    get description() {
        return 'Lists all configured notification templates.';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const notifications = await readNotificationsFile();
        const notificationNames = Object.keys(notifications);

        if (notificationNames.length === 0) {
            return interaction.editReply({ content: 'There are no notification templates configured yet.' });
        }

        const embed = new EmbedBuilder()
            .setColor(this.client.color)
            .setTitle('Active Notification Templates')
            .setTimestamp();
        
        let fields = [];
        for (const name of notificationNames) {
            const notif = notifications[name];
            const pingRole = notif.pingRoleId ? `<@&${notif.pingRoleId}>` : 'None';
            
            const fieldValue = "```" + `Target: ${notif.target}\nPing Role: ${pingRole}` + "```";

            fields.push({
                name: name,
                value: fieldValue
            });
        }
        
        // Handle embed field limits
        const fieldChunks = [];
        for (let i = 0; i < fields.length; i += 25) {
            fieldChunks.push(fields.slice(i, i + 25));
        }

        for (let i = 0; i < fieldChunks.length; i++) {
            const chunk = fieldChunks[i];
            const chunkEmbed = new EmbedBuilder()
                .setColor(this.client.color)
                .setTitle(`Active Notification Templates ${fieldChunks.length > 1 ? `(Page ${i + 1})` : ''}`)
                .setTimestamp()
                .addFields(chunk);

            if (i === 0) {
                await interaction.editReply({ embeds: [chunkEmbed] });
            } else {
                await interaction.followUp({ embeds: [chunkEmbed], ephemeral: true });
            }
        }
    }
} 