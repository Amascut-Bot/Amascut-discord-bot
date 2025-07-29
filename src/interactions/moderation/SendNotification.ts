import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction, TextChannel, EmbedBuilder } from 'discord.js';
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

export default class SendNotification extends BotInteraction {
    get name() {
        return 'sendnotif';
    }

    get description() {
        return 'Sends a pre-made notification to a target audience.';
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
                    .setDescription('The name of the notification template to send.')
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
        await interaction.deferReply({ ephemeral: true });

        const notificationName = interaction.options.getString('notification_name', true);
        const notifications = await readNotificationsFile();
        const notification = notifications[notificationName];

        if (!notification) {
            await interaction.editReply({ content: `A notification template with the name "${notificationName}" could not be found.` });
            return;
        }

        const categoryMap: { [key: string]: { id: string; prefix: string; } } = {
            'Learners': { id: '782166855368441866', prefix: 'learnapp-' },
            'Reapers': { id: '922046316677304380', prefix: 'ticket-' }
        };

        const targetInfo = categoryMap[notification.target];
        if (!targetInfo) {
            await interaction.editReply({ content: `Invalid target audience specified in the notification template: "${notification.target}".` });
            return;
        }

        const targetChannels = interaction.guild?.channels.cache.filter(channel =>
            channel.parentId === targetInfo.id &&
            channel.name.startsWith(targetInfo.prefix) &&
            channel.isTextBased()
        ) as Map<string, TextChannel> | undefined;

        if (!targetChannels || targetChannels.size === 0) {
            await interaction.editReply({ content: `No target channels found for the audience: "${notification.target}".` });
            return;
        }

        // Re-upload assets and build the embed
        const finalEmbedData = { ...notification.embed };
        if (finalEmbedData.image) {
            finalEmbedData.image = await this.client.util.reuploadImage(finalEmbedData.image);
        }
        if (finalEmbedData.thumbnail) {
            finalEmbedData.thumbnail = await this.client.util.reuploadImage(finalEmbedData.thumbnail);
        }

        const embed = new EmbedBuilder();
        if (finalEmbedData.title) embed.setTitle(finalEmbedData.title);
        if (finalEmbedData.description) embed.setDescription(finalEmbedData.description);
        if (finalEmbedData.footer) embed.setFooter({ text: finalEmbedData.footer });
        if (finalEmbedData.image) embed.setImage(finalEmbedData.image);
        if (finalEmbedData.thumbnail) embed.setThumbnail(finalEmbedData.thumbnail);

        let channelsSent = 0;
        for (const channel of targetChannels.values()) {
            try {
                if (notification.pingRoleId) {
                    await channel.send(`<@&${notification.pingRoleId}>`);
                }
                await channel.send({ embeds: [embed] });
                channelsSent++;
            } catch (err) {
                this.client.logger.error({
                    handler: this.constructor.name,
                    message: `Failed to send notification to channel #${channel.name} (${channel.id})`,
                    error: err
                });
            }
        }

        await interaction.editReply({ content: `Successfully sent the notification **${notificationName}** to ${channelsSent} out of ${targetChannels.size} target channel(s).` });
    }
}
