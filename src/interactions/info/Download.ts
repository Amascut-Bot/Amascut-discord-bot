import BotInteraction from '../../types/BotInteraction';
import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, AttachmentBuilder, ChannelType, APIEmbed, EmbedBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export default class Download extends BotInteraction {
    get name() {
        return 'download';
    }

    get description() {
        return 'Downloads recent channel history into a .txt file compatible with /upload.';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The channel to download messages from')
                    .setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel', true) as TextChannel;
        
        try {
            const tagsFilePath = path.join(process.cwd(), 'message-tags.json');
            let tags: { [channelId: string]: { [messageId: string]: string } } = {};
            try {
                const rawData = await fs.readFile(tagsFilePath, 'utf-8');
                tags = JSON.parse(rawData);
            } catch (error) {
                // Don't worry about it.
            }

            const channelTags = tags[channel.id] || {};

            const messages = await channel.messages.fetch({ limit: 100 });
            if (messages.size === 0) {
                return interaction.editReply({ content: 'No messages found in that channel to download.' });
            }

            const reversedMessages = Array.from(messages.values()).reverse();
            const messageBlocks: string[] = [];

            for (const message of reversedMessages) {
                let currentBlock = '';
                const tagName = channelTags[message.id];
                if (tagName) {
                    currentBlock += `{name:${tagName}}\n`;
                }

                if (message.content) {
                    currentBlock += message.content;
                }

                if (message.embeds.length > 0) {
                    if (message.content) {
                        currentBlock += '\n';
                    }
                    const embedStrings = message.embeds.map(embed => {
                        const embedJson = this.cleanEmbed(embed.toJSON());
                        return `{embed}\n${JSON.stringify(embedJson, null, 2)}\n{/embed}`;
                    });
                    currentBlock += embedStrings.join('\n');
                }

                if (message.attachments.size > 0) {
                    if (message.content || message.embeds.length > 0) {
                         currentBlock += '\n';
                    }
                    const attachmentStrings = message.attachments
                        .filter(att => att.contentType?.startsWith('image/'))
                        .map(att => {
                            const imageEmbed = { image: { url: att.url } };
                            return `{embed}\n${JSON.stringify(imageEmbed, null, 2)}\n{/embed}`;
                        });
                    currentBlock += attachmentStrings.join('\n');
                }
                
                if (currentBlock) {
                    messageBlocks.push(currentBlock);
                }
            }

            if (messageBlocks.length === 0) {
                return interaction.editReply({ content: 'Found messages, but could not extract any downloadable content (text, embeds, or images).' });
            }

            const fileContent = messageBlocks.join('\n.\n');

            const attachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), {
                name: `${channel.name}-archive.txt`,
            });

            // Send log message
            try {
                const logChannelId = '1387201503428870399';
                const logChannel = await this.client.channels.fetch(logChannelId);
                if (logChannel instanceof TextChannel) {
                    // Create a new attachment to be sent to the log channel
                    const logAttachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), {
                        name: `${channel.name}-archive.txt`,
                    });
                    await logChannel.send({ 
                        content: `${interaction.user.username} downloaded from <#${channel.id}>`,
                        files: [logAttachment] 
                    });
                }
            } catch (logError) {
                this.client.logger.error({
                    message: 'Failed to send download log.',
                    handler: this.name,
                    error: logError as Error
                });
            }

            await interaction.editReply({
                content: `Here is the archive of the last ${reversedMessages.length} messages from <#${channel.id}>.`,
                files: [attachment],
            });

        } catch (error) {
            this.client.logger.error({
                error: error,
                handler: this.constructor.name,
                message: `Failed to download messages from #${channel.name}`
            });
            await interaction.editReply({ content: 'An error occurred while trying to download the messages.' });
        }
    }

    private cleanEmbed(embedData: APIEmbed): any {
        const newEmbed: any = {};

        if (embedData.title) newEmbed.title = embedData.title;
        if (embedData.description) newEmbed.description = embedData.description;
        if (embedData.url) newEmbed.url = embedData.url;
        if (embedData.timestamp) newEmbed.timestamp = new Date(embedData.timestamp).toISOString();
        if (embedData.color) newEmbed.color = embedData.color;

        if (embedData.footer) {
            newEmbed.footer = { text: embedData.footer.text };
            if (embedData.footer.icon_url) {
                newEmbed.footer.icon_url = embedData.footer.icon_url;
            }
        }

        if (embedData.image?.url) {
            newEmbed.image = { url: embedData.image.url };
        }

        if (embedData.thumbnail?.url) {
            newEmbed.thumbnail = { url: embedData.thumbnail.url };
        }

        if (embedData.author) {
            newEmbed.author = { name: embedData.author.name };
            if (embedData.author.url) {
                newEmbed.author.url = embedData.author.url;
            }
            if (embedData.author.icon_url) {
                newEmbed.author.icon_url = embedData.author.icon_url;
            }
        }

        if (embedData.fields && embedData.fields.length > 0) {
            newEmbed.fields = embedData.fields.map((field: any) => ({
                name: field.name,
                value: field.value,
                inline: field.inline || false,
            }));
        }

        return newEmbed;
    }
} 