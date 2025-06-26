import BotInteraction from '../../types/BotInteraction';
import { Attachment, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, ChannelType } from 'discord.js';

interface ParsedSection {
    name?: string;
    embeds: any[];
    content?: string;
}

export default class Upload extends BotInteraction {
    get name() {
        return 'upload';
    }

    get description() {
        return 'Upload and parse a text file to send as Discord messages';
    }

    get permissions() {
        return 'ELEVATED_ROLE'; // Change this based on your requirements
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addAttachmentOption((option) => 
                option
                    .setName('file')
                    .setDescription('The text file to parse and send')
                    .setRequired(true)
            )
            .addChannelOption((option) =>
                option
                    .setName('channel')
                    .setDescription('Which channel to send the message to')
                    .setRequired(false)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            );
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const attachment: Attachment | null = interaction.options.getAttachment('file', true);
        const targetChannel = interaction.options.getChannel('channel', false) || interaction.channel;

        if (!attachment) {
            return await interaction.editReply({ content: 'No file was provided.' });
        }

        // Validate target channel
        if (!targetChannel || !('send' in targetChannel)) {
            return await interaction.editReply({ 
                content: 'Invalid channel selected. Please choose a text channel.' 
            });
        }

        // Validate file type
        if (!attachment.name?.endsWith('.txt') && attachment.contentType !== 'text/plain') {
            return await interaction.editReply({ 
                content: 'Please upload a valid text file (.txt).' 
            });
        }

        // Validate file size (Discord has a limit, let's be conservative)
        if (attachment.size > 1024 * 1024) { // 1MB limit
            return await interaction.editReply({ 
                content: 'File is too large. Please upload a file smaller than 1MB.' 
            });
        }

        try {
            // Fetch file content
            const response = await fetch(attachment.url);
            const fileContent = await response.text();

            if (!fileContent.trim()) {
                return await interaction.editReply({ 
                    content: 'The uploaded file is empty.' 
                });
            }

            // Parse the file content
            const parsedSections = this.parseFileContent(fileContent);

            if (parsedSections.length === 0) {
                return await interaction.editReply({ 
                    content: 'No valid content found in the file. Please check the format.' 
                });
            }

            // Convert emojis in all sections
            this.convertEmojisInSections(parsedSections, interaction);

            // Send confirmation
            await interaction.editReply({ 
                content: `Successfully parsed ${parsedSections.length} section(s). Sending messages to ${targetChannel === interaction.channel ? 'this channel' : `<#${targetChannel.id}>`}...` 
            });

            // Log the upload to the designated channel
            const logChannelId = this.client.util.channels.uploadLogChannel;
            if (logChannelId && logChannelId !== 'YOUR_CHANNEL_ID_HERE') {
                const logChannel = await this.client.channels.fetch(logChannelId) as TextChannel;
                if (logChannel) {
                    await logChannel.send({
                        content: `${interaction.user.username} <#${interaction.channel?.id}>`,
                        files: [attachment]
                    });
                }
            }

            // Send parsed content to the target channel
            for (const section of parsedSections) {
                try {
                    if (section.embeds.length > 0) {
                        // Send embeds
                        const embedsToSend = section.embeds.map(embedData => {
                            const embed = new EmbedBuilder();
                            if (embedData.description) embed.setDescription(embedData.description);
                            if (embedData.color) embed.setColor(embedData.color);
                            if (embedData.title) embed.setTitle(embedData.title);
                            if (embedData.fields) embed.setFields(embedData.fields);
                            if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail.url);
                            if (embedData.image) embed.setImage(embedData.image.url);
                            if (embedData.footer) embed.setFooter(embedData.footer);
                            if (embedData.author) embed.setAuthor(embedData.author);
                            return embed;
                        });

                        // Discord has a limit of 10 embeds per message
                        for (let i = 0; i < embedsToSend.length; i += 10) {
                            const embedBatch = embedsToSend.slice(i, i + 10);
                            await targetChannel.send({ embeds: embedBatch });
                        }
                    }

                    if (section.content && section.content.trim()) {
                        // Split content if it exceeds Discord's 2000 character limit
                        const content = section.content.trim();
                        if (content.length <= 2000) {
                            await targetChannel.send({ content });
                        } else {
                            // Split content into chunks of 2000 characters or less
                            const chunks = this.splitContent(content, 2000);
                            for (const chunk of chunks) {
                                await targetChannel.send({ content: chunk });
                            }
                        }
                    }
                } catch (error) {
                    this.client.logger.error({
                        error: error,
                        handler: this.constructor.name,
                        message: 'Error sending parsed section'
                    });
                }
            }

        } catch (error) {
            this.client.logger.error({
                error: error,
                handler: this.constructor.name,
                message: 'Error processing uploaded file'
            });

            return await interaction.editReply({ 
                content: 'An error occurred while processing the file. Please check the file format and try again.' 
            });
        }
    }

    private parseFileContent(content: string): ParsedSection[] {
        const sections: ParsedSection[] = [];
        let currentSection: ParsedSection = { embeds: [] };
        
        // Split content by lines and process
        const lines = content.split('\n');
        let inEmbed = false;
        let embedContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines that aren't part of embed content
            if (!line && !inEmbed) continue;
            
            // Handle section names
            if (line.match(/^\{name:(.+)\}$/)) {
                // If we have a current section with content, save it
                if (currentSection.embeds.length > 0 || currentSection.content) {
                    sections.push(currentSection);
                }
                // Start new section
                const name = line.match(/^\{name:(.+)\}$/)?.[1];
                currentSection = { name, embeds: [] };
                continue;
            }
            
            // Handle embed start
            if (line === '{embed}') {
                inEmbed = true;
                embedContent = '';
                continue;
            }
            
            // Handle embed end
            if (line === '{/embed}') {
                if (inEmbed && embedContent.trim()) {
                    try {
                        const embedData = JSON.parse(embedContent);
                        currentSection.embeds.push(embedData);
                    } catch (error) {
                        this.client.logger.error({
                            error: error,
                            handler: this.constructor.name,
                            message: 'Failed to parse embed JSON'
                        });
                    }
                }
                inEmbed = false;
                embedContent = '';
                continue;
            }
            
            // Handle content inside embeds
            if (inEmbed) {
                embedContent += line + '\n';
                continue;
            }
            
            // Handle separators
            if (line === '.' || line.match(/^\*\*\s*\*\*\s*\*\*\s*\*\*$/)) {
                // This is a separator, could be used to split sections or just ignore
                continue;
            }
            
            // Handle regular content (outside of embeds)
            if (line && !inEmbed) {
                if (!currentSection.content) {
                    currentSection.content = '';
                }
                currentSection.content += line + '\n';
            }
        }
        
        // Don't forget the last section
        if (currentSection.embeds.length > 0 || currentSection.content) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    private splitContent(content: string, maxLength: number): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        
        // Split by lines to avoid breaking mid-sentence
        const lines = content.split('\n');
        
        for (const line of lines) {
            // If adding this line would exceed the limit
            if (currentChunk.length + line.length + 1 > maxLength) {
                // If we have content in current chunk, save it
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                
                // If the line itself is too long, split it
                if (line.length > maxLength) {
                    let remainingLine = line;
                    while (remainingLine.length > maxLength) {
                        chunks.push(remainingLine.substring(0, maxLength));
                        remainingLine = remainingLine.substring(maxLength);
                    }
                    if (remainingLine.trim()) {
                        currentChunk = remainingLine;
                    }
                } else {
                    currentChunk = line;
                }
            } else {
                // Add line to current chunk
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }
        
        // Don't forget the last chunk
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    private convertEmojisInSections(sections: ParsedSection[], interaction: ChatInputCommandInteraction): void {
        for (const section of sections) {
            // Convert emojis in embeds
            for (const embedData of section.embeds) {
                if (embedData.description) {
                    embedData.description = this.convertEmojis(embedData.description, interaction);
                }
                if (embedData.title) {
                    embedData.title = this.convertEmojis(embedData.title, interaction);
                }
                if (embedData.fields) {
                    for (const field of embedData.fields) {
                        if (field.name) field.name = this.convertEmojis(field.name, interaction);
                        if (field.value) field.value = this.convertEmojis(field.value, interaction);
                    }
                }
                if (embedData.footer && embedData.footer.text) {
                    embedData.footer.text = this.convertEmojis(embedData.footer.text, interaction);
                }
                if (embedData.author && embedData.author.name) {
                    embedData.author.name = this.convertEmojis(embedData.author.name, interaction);
                }
            }

            // Convert emojis in regular content
            if (section.content) {
                section.content = this.convertEmojis(section.content, interaction);
            }
        }
    }

    private convertEmojis(text: string, interaction: ChatInputCommandInteraction): string {
        // Pattern to match :emojiname: format
        const emojiPattern = /:([a-zA-Z0-9_]+):/g;
        
        return text.replace(emojiPattern, (match, emojiName) => {
            // First try to find the emoji in the current guild
            let emoji = interaction.guild?.emojis.cache.find(e => e.name === emojiName);
            
            // If not found in current guild, search all guilds the bot has access to
            if (!emoji) {
                for (const guild of this.client.guilds.cache.values()) {
                    emoji = guild.emojis.cache.find(e => e.name === emojiName);
                    if (emoji) break;
                }
            }
            
            // If emoji found, return the Discord format, otherwise return original
            if (emoji) {
                return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
            }
            
            // If not found, return the original :emojiname: format
            return match;
        });
    }
} 