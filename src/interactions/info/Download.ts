import BotInteraction from '../../types/BotInteraction';
import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, AttachmentBuilder, ChannelType, APIEmbed } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getChannels } from '../../GuildSpecifics';

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

    get options() {
        const assignOptions: any = {
            'Yes': 'yes',
            'No': 'no',
        }
        const options: any = [];
        Object.keys(assignOptions).forEach((key: string) => {
            options.push({ name: key, value: assignOptions[key] })
        })
        return options;
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
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread)
            ).addStringOption((option) => option.setName('archived').setDescription('Download from Upload-Archive if existing').addChoices(
                ...this.options
            ).setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel', true) as TextChannel;
        const archived = (interaction.options.getString('archived', false) ?? 'yes') === 'yes';

        try {
            //try to find an archived file first, if no one to be found, download the channel
            const archiveDir = path.join(process.cwd(), 'upload_archives');
            //2025-07-14T21-37-50.955Z_test-channel_role-assign-archive3
            const pattern = new RegExp(channel.name);

            const archivedFile = await this.getNewestFile(archiveDir, pattern);

            if (archivedFile && archived) {
                const fileContent = await fs.readFile(archivedFile, 'utf-8');

                const attachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), {
                    name: `${channel.name}-archive.txt`,
                });

                // Send log message
                try {
                    const logChannelId = interaction.channelId;
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

                return await interaction.editReply({
                    content: `Here is the archive of the last uplaod from <#${channel.id}>.`,
                    files: [attachment],
                });
            }

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
                    currentBlock += `.tag:${tagName}\n`;
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
                        return `\n${JSON.stringify(embedJson, null, 2)}\n.embed:json`;
                    });
                    currentBlock += embedStrings.join('\n');
                }

                //for componentsV2 you can just parse the whole container
                if (message.components.length > 0) {
                    const { cleanContainer } = this.client.util;
                    const cleanUp = cleanContainer.bind(this.client.util)
                    const container = cleanUp(message.components[0]);
                    const containerJson = JSON.stringify(container, null, 2);
                    currentBlock += `\n${containerJson}\n.componentsV2:json`;
                }

                if (message.attachments.size > 0) {
                    if (message.content || message.embeds.length > 0) {
                        currentBlock += '\n';
                    }
                    const attachmentStrings = message.attachments
                        .filter(att => att.contentType?.startsWith('image/'))
                        .map(att => {
                            const imageEmbed = { image: { url: att.url } };
                            return `\n${JSON.stringify(imageEmbed, null, 2)}\n.embed:json`;
                        });
                    currentBlock += attachmentStrings.join('\n');
                }

                if (message.pinned) {
                    currentBlock += `\n.pin:delete`;
                }

                currentBlock = await this.resolveToc(currentBlock, channelTags, channel.id, channel.guildId);

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
                const logChannelId = getChannels(interaction.guild?.id).uploadLogChannel;
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

    private async getNewestFile(dir: string, pattern: RegExp) {
        await fs.mkdir(dir, { recursive: true });
        const files = await fs.readdir(dir);

        const matchedFiles = await Promise.all(
            files
                .filter(file => pattern.test(file))
                .map(async file => {
                    const filePath = path.join(dir, file);
                    const stats = await fs.stat(filePath);
                    return { file: filePath, mtime: (stats).mtime };
            }));

        if (matchedFiles.length === 0) {
            return null;
        }

        matchedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

        return matchedFiles[0].file;
    }

    //check content for a discord message link and replace the tags if known
    private async resolveToc(content: string, channelTags: any, channelId: string, guildId: string): Promise<string> {
        let result: string = content;
        const pattern = `(https:\\/\\/discord\\.com\\/channels\\/${guildId}\\/${channelId}\\/(\\d+))`;
        const regex = new RegExp(pattern, 'g');

        const matches = [...result.matchAll(regex)];

        if (matches.length > 0) {
            matches.forEach(match => {
                const tagName = channelTags[match[2]];

                if (tagName) {
                    const url = `(https://discord.com/channels/${guildId}/${channelId}/${match[2]})`;
                    const replacement = `($linkmsg_${tagName}$)`;
                    result = result.replace(url, replacement);
                }
            });
        }
        return result;
    }
}
