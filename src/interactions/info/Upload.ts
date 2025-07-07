import BotInteraction from '../../types/BotInteraction';
import { Attachment, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel, ChannelType, Message, MessageFlags } from 'discord.js';
import { parseTree, getNodeValue, ParseError } from 'jsonc-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

type ParsedMessage = {
    content: string;
    embeds: any[];
    rawEmbeds?: string[];
    nameTag?: string;
    hasPlaceholders?: boolean;
    sentMessage?: Message;
    pinAndDeleteOld?: boolean;
};

function getErrorMessageForCode(e: number): string {
    switch (e) {
        case 1: return 'Invalid symbol';
        case 2: return 'Invalid number format';
        case 3: return 'Property name expected';
        case 4: return 'Value expected';
        case 5: return 'Colon expected';
        case 6: return 'Comma expected';
        case 7: return 'Closing brace expected';
        case 8: return 'Closing bracket expected';
        case 9: return 'End of file expected';
        case 10: return 'Invalid comment token';
        case 11: return 'Unexpected end of comment';
        case 12: return 'Unexpected end of string';
        case 13: return 'Unexpected end of number';
        case 14: return 'Invalid unicode';
        case 15: return 'Invalid escape character';
        case 16: return 'Invalid character';
        default: return 'Unknown parse error';
    }
}

class ParsingError extends Error {
    constructor(message: string, public errors: { description: string, correctedCode: string }[]) {
        super(message);
        this.name = 'ParsingError';
    }
}

export default class Upload extends BotInteraction {
    get name() {
        return 'upload';
    }

    get description() {
        return 'Upload and parse a text file to send as Discord messages';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const attachment: Attachment | null = interaction.options.getAttachment('file', true);
        const targetChannel = (interaction.options.getChannel('channel', false) || interaction.channel) as TextChannel;

        if (!attachment) {
            return await interaction.editReply({ content: 'No file was provided.' });
        }

        if (!targetChannel || !('send' in targetChannel)) {
            return await interaction.editReply({ 
                content: 'Invalid channel selected. Please choose a text channel.' 
            });
        }

        if (!attachment.name?.endsWith('.txt') && attachment.contentType !== 'text/plain') {
            return await interaction.editReply({ 
                content: 'Please upload a valid text file (.txt).' 
            });
        }

        if (attachment.size > 5 * 1024 * 1024) { // 5MB limit
            return await interaction.editReply({ 
                content: 'File is too large. Please upload a file smaller than 5MB.' 
            });
        }

        try {
            const tagsFilePath = path.join(process.cwd(), 'message-tags.json');
            let tags: { [channelId: string]: { [messageId: string]: string } } = {};
            try {
                const rawData = await fs.readFile(tagsFilePath, 'utf-8');
                tags = JSON.parse(rawData);
            } catch (error) {
                this.client.logger.error({ message: 'INFO: message-tags.json not found or invalid, starting fresh. This is expected on first run.', handler: this.name, error: error as Error });
            }

            const response = await fetch(attachment.url);
            const fileContent = await response.text();

            try {
                const archiveDir = path.join(process.cwd(), 'upload_archives');
                await fs.mkdir(archiveDir, { recursive: true });
                const timestamp = new Date().toISOString().replace(/:/g, '-');
                const archiveFileName = `${timestamp}_${targetChannel.name}_${attachment.name}`;
                const archiveFilePath = path.join(archiveDir, archiveFileName);
                await fs.writeFile(archiveFilePath, fileContent);
            } catch (archiveError) {
                this.client.logger.error({
                    message: 'Failed to archive uploaded file.',
                    handler: this.name,
                    error: archiveError as Error
                });
            }

            if (!fileContent.trim()) {
                return await interaction.editReply({ 
                    content: 'The uploaded file is empty.' 
                });
            }

            const parsedParts: ParsedMessage[] = this.parseFileContent(fileContent);

            // Pre-flight check for unresolved tags before sending any messages
            const definedTags = new Set(parsedParts.map(p => p.nameTag).filter(Boolean) as string[]);
            const linkErrors: { name: string, value: string }[] = [];
            const placeholderRegex = /\$linkmsg_([^$]+)\$/g;

            for (const part of parsedParts) {
                if (!part.hasPlaceholders) continue;
        
                const partIdentifier = part.nameTag ? `the message tagged \`${part.nameTag}\`` : `a message with no tag`;
        
                const checkAndCorrect = (text: string): { corrected: string, hasErrors: boolean } => {
                    let correctedText = text;
                    let hasErrors = false;
                    
                    correctedText = correctedText.replace(placeholderRegex, (match, tagName) => {
                        if (definedTags.has(tagName)) {
                            return match;
                        }
        
                        hasErrors = true;
                        const bestMatch = this.findBestMatch(tagName, definedTags);
                        if (bestMatch) {
                            return `$linkmsg_${bestMatch}$`;
                        }
        
                        return match;
                    });
        
                    return { corrected: correctedText, hasErrors };
                };
                
                if (part.rawEmbeds) {
                    for (const rawEmbed of part.rawEmbeds) {
                        const result = checkAndCorrect(rawEmbed);
                        if (result.hasErrors) {
                            try {
                                const originalFormatted = JSON.stringify(JSON.parse(rawEmbed), null, 2);
                                const correctedFormatted = JSON.stringify(JSON.parse(result.corrected), null, 2);
                                linkErrors.push({
                                    name: `an embed in ${partIdentifier}`,
                                    value: `**Original:**\n\`\`\`json\n${originalFormatted}\n\`\`\`\n**Suggested:**\n\`\`\`json\n${correctedFormatted}\n\`\`\``
                                });
                            } catch(e) {
                                linkErrors.push({
                                    name: `an embed in ${partIdentifier}`,
                                    value: `**Original:**\n\`\`\`json\n${rawEmbed}\n\`\`\`\n**Suggested:**\n\`\`\`json\n${result.corrected}\n\`\`\``
                                });
                            }
                        }
                    }
                }
            }
            
            if (linkErrors.length > 0) {
                await interaction.editReply({ content: 'Your file has link errors and was not uploaded. See details below.' });
            
                const textChunks = linkErrors.map(field => {
                    return `**Found an issue in ${field.name}:**\n${field.value}`;
                });
            
                for (let i = 0; i < textChunks.length; i += 2) {
                    const chunk = textChunks.slice(i, i + 2);
                    await interaction.followUp({
                        content: `**Link Errors Found**\nI've provided suggestions for the segments below. You can copy the corrected versions.\n\n${chunk.join('\n\n')}`,
                        ephemeral: true,
                    });
                }
            
                return;
            }

            const uploadPromises: Promise<void>[] = [];
            for (const part of parsedParts) {
                for (const embed of part.embeds) {
                    if (embed.thumbnail?.url) {
                        uploadPromises.push(
                            this.client.util.reuploadImage(embed.thumbnail.url).then(newUrl => {
                                embed.thumbnail.url = newUrl;
                            })
                        );
                    }
                    if (embed.image?.url) {
                        uploadPromises.push(
                            this.client.util.reuploadImage(embed.image.url).then(newUrl => {
                                embed.image.url = newUrl;
                            })
                        );
                    }
                }
            }
            await Promise.all(uploadPromises);

            const sentMessageCount = parsedParts.filter(p => p.content || p.embeds.length > 0).length;
            
            await interaction.editReply({ 
                content: `Successfully parsed your file. Sending ${sentMessageCount} message(s) to ${targetChannel === interaction.channel ? 'this channel' : `<#${targetChannel.id}>`}. This may take a moment...` 
            });

            const logChannelId = this.client.util.channels.uploadLogChannel;
            if (logChannelId && logChannelId !== 'YOUR_CHANNEL_ID_HERE') {
                const logChannel = await this.client.channels.fetch(logChannelId) as TextChannel;
                if (logChannel) {
                    await logChannel.send({
                        content: `${interaction.user.username} uploaded to <#${targetChannel.id}>`,
                        files: [attachment]
                    });
                }
            }

            const tagToUrlMap = new Map<string, string>();
            const messagesToEdit: ParsedMessage[] = [];

            // 1st Pass: Send messages and map tags
            try {
                for (const part of parsedParts) {
                    const { content, embeds } = part;
                    if (!content && embeds.length === 0) {
                        continue;
                    }

                    // Convert emojis in content and embeds
                    const finalContent = content ? this.convertEmojis(content, interaction) : '';
                    const finalEmbeds = embeds.map(embed => this.convertEmbedEmojis(embed, interaction));

                    const sentMessage = await targetChannel.send({ 
                        content: finalContent || undefined,
                        embeds: finalEmbeds
                    });
                    part.sentMessage = sentMessage;

                    if (part.nameTag) {
                        if (!tags[targetChannel.id]) {
                            tags[targetChannel.id] = {};
                        }
                        
                        const oldMessageId = Object.keys(tags[targetChannel.id]).find(
                            (msgId) => tags[targetChannel.id][msgId] === part.nameTag
                        );
                        if (oldMessageId) {
                            if (part.pinAndDeleteOld) {
                                try {
                                    const oldMessage = await targetChannel.messages.fetch(oldMessageId);
                                    await oldMessage.delete();
                                } catch (e) {
                                    this.client.logger.error({ message: `Could not delete old tagged message ${oldMessageId}`, error: e as Error});
                                }
                            }
                            delete tags[targetChannel.id][oldMessageId];
                        }

                        tags[targetChannel.id][sentMessage.id] = part.nameTag;
                        tagToUrlMap.set(part.nameTag, sentMessage.url);
                    }

                    // Always pin messages that contain Table of Contents
                    const hasTableOfContents = finalEmbeds.some(embed => 
                        embed.title && embed.title.toLowerCase().includes('table of contents')
                    );
                    
                    if (hasTableOfContents) {
                        try {
                            await sentMessage.pin();
                            this.client.logger.log({ message: `Successfully pinned Table of Contents message ${sentMessage.id}` }, true);
                            
                            // Wait a moment for Discord to create the pin notification system message
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            
                            // Only delete the pin notification if .pin:delete is present in the file
                            if (part.pinAndDeleteOld) {
                                try {
                                    const messages = await targetChannel.messages.fetch({ limit: 10 });
                                    const pinNotification = messages.find(msg => 
                                        msg.type === 6 && // MessageType.ChannelPinnedMessage
                                        msg.createdTimestamp > sentMessage.createdTimestamp
                                    );
                                    
                                    if (pinNotification) {
                                        await pinNotification.delete();
                                        this.client.logger.log({ message: `Successfully deleted pin notification system message ${pinNotification.id}` }, true);
                                    } else {
                                        this.client.logger.log({ message: `No pin notification system message found to delete` }, true);
                                    }
                                } catch (deleteError) {
                                    this.client.logger.error({ message: `Could not delete pin notification system message`, error: deleteError as Error});
                                }
                            }
                        } catch(e) {
                            this.client.logger.error({ message: `Could not pin message ${sentMessage.id}`, error: e as Error});
                        }
                    }
                    if (part.hasPlaceholders) {
                        messagesToEdit.push(part);
                    }
                }
            } catch (e: any) {
			this.client.logger.error({
                    error: e,
                    handler: this.name,
                    message: 'Error sending message with embed'
                });

                let errorDetails = 'An error occurred while sending a message. This is likely due to an invalid embed structure.';
                if (e.rawError?.errors?.embeds) {
                    const embedErrors = e.rawError.errors.embeds;
                    const errorIndex = Object.keys(embedErrors)[0];
                    const errorPath = Object.keys(embedErrors[errorIndex])[0];
                    const errorMessage = embedErrors[errorIndex][errorPath]._errors[0].message;

                    errorDetails = `**Invalid Embed Structure:**\n> **Error in field \`${errorPath}\` of an embed:**\n> ${errorMessage}`;
                }

                await interaction.followUp({
                    content: errorDetails,
                    ephemeral: true,
                });
                return;
            }

            // 2nd Pass: Edit messages with placeholders
            if (messagesToEdit.length > 0) {
                for (const partToEdit of messagesToEdit) {
                    if (!partToEdit.sentMessage) continue;
    
                    let newContent = partToEdit.content;
                    if (newContent) {
                        newContent = this.resolvePlaceholders(newContent, tagToUrlMap, { channelId: targetChannel.id });
                        newContent = this.convertEmojis(newContent, interaction);
                    }
    
                    // Resolve placeholders in embeds too
                    const newEmbeds = partToEdit.embeds.map(embed => {
                        let embedString = JSON.stringify(embed);
                        embedString = this.resolvePlaceholders(embedString, tagToUrlMap, { channelId: targetChannel.id });
                        const resolvedEmbed = JSON.parse(embedString);
                        return this.convertEmbedEmojis(resolvedEmbed, interaction);
                    });
    
                    try {
                        await partToEdit.sentMessage.edit({
                            content: newContent || undefined,
                            embeds: newEmbeds
                        });
                    } catch (e) {
                        this.client.logger.error({ message: `Failed to edit message ${partToEdit.sentMessage.id}`, error: e as Error });
                            }
                        }
                    }

            await fs.writeFile(tagsFilePath, JSON.stringify(tags, null, 2));
            
            // If we get here, everything was successful with no corrections needed
            await interaction.editReply({ content: 'Your file has been uploaded successfully!' });

        } catch (error: any) {
            if (error instanceof ParsingError) {
                const fields = error.errors.map(e => ({
                    name: `JSON block starting at line ${e.description}`,
                    value: e.correctedCode.substring(0, 1020)
                }));
                await interaction.editReply({ content: 'Your file had some issues that were corrected. Check the details below.' });
                for(let i = 0; i < fields.length; i += 5) {
                    const chunk = fields.slice(i, i + 5);
                    // Send JSON as plain text instead of embeds
                    const jsonTexts = chunk.map(field => {
                        // Extract JSON from either "**Corrected segment:**" or "**JSON segment:**" format
                        const correctedMatch = field.value.match(/\*\*(?:Corrected segment|JSON segment):\*\*\n```json\n([\s\S]*?)\n```/);
                        let jsonContent = correctedMatch ? correctedMatch[1] : field.value;
                        
                        // If no match found, try to extract any JSON from the field value
                        if (!correctedMatch) {
                            const anyJsonMatch = field.value.match(/```json\n([\s\S]*?)\n```/);
                            if (anyJsonMatch) {
                                jsonContent = anyJsonMatch[1];
                            } else {
                                // Try to parse the entire field.value as JSON
                                try {
                                    const parsed = JSON.parse(jsonContent);
                                    jsonContent = JSON.stringify(parsed, null, 2);
                                } catch (e) {
                                    // If parsing fails, use as-is
                                }
                            }
                        }
                        
                        return `**${field.name}**\n\`\`\`json\n${jsonContent}\n\`\`\``;
                    }).join('\n\n');
                    
                    await interaction.followUp({
                        content: `**JSON Segments from Your File**\nYou can copy them easily from here:\n\n${jsonTexts}`,
                        ephemeral: true,
                    });
                }
            } else {
                this.client.logger.error({
                    error: error,
                    handler: this.name,
                    message: `An unexpected error occurred in the upload command.`
                });
                 await interaction.editReply({
                    content: 'An unexpected error occurred while processing your file.'
                });
            }
        }
    }

    private parseFileContent(content: string): ParsedMessage[] {
        // Strip BOM if it exists
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.substring(1);
        }
        const lines = content.split(/\r?\n/);
        const messages: ParsedMessage[] = [];
        let currentMessage: ParsedMessage = { content: '', embeds: [], rawEmbeds: [] };
        let nextMessageNameTag: string | undefined = undefined;
        const allParsingErrors: { description: string, correctedCode: string }[] = [];

        const finalizeCurrentMessage = () => {
            if (currentMessage.content.trim() || currentMessage.embeds.length > 0) {
                if (nextMessageNameTag) {
                    currentMessage.nameTag = nextMessageNameTag;
                    nextMessageNameTag = undefined;
                }
                if (currentMessage.content) {
                    currentMessage.hasPlaceholders = this.hasLinkPlaceholder(currentMessage.content);
                }
                currentMessage.embeds.forEach(embed => {
                    let embedString = JSON.stringify(embed);
                    if (this.hasLinkPlaceholder(embedString)) {
                        currentMessage.hasPlaceholders = true;
                    }
                });
                messages.push(currentMessage);
            }
            currentMessage = { content: '', embeds: [], rawEmbeds: [] };
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('.img:')) {
                finalizeCurrentMessage();
                const imageUrl = trimmedLine.substring(5).trim();
                if (imageUrl) {
                    messages.push({ content: imageUrl, embeds: [] });
                }
                continue;
            }

            if (trimmedLine.startsWith('.tag:')) {
                finalizeCurrentMessage();
                const tagName = trimmedLine.substring(5).trim().replace(/\s+/g, '_');
                if (tagName) {
                    nextMessageNameTag = tagName;
                }
                continue;
            }

            if (trimmedLine.startsWith('.pin:delete')) {
                currentMessage.pinAndDeleteOld = true;
                continue;
            }

            // Handle .embed:json directive (can come before or after JSON block)
            if (trimmedLine.startsWith('.embed:json')) {
                // Look backwards for JSON block first
                let jsonBlock = '';
                let foundJsonBackwards = false;
                
                // Check if there's a JSON block before this directive
                for (let k = i - 1; k >= 0; k--) {
                    const prevLine = lines[k].trim();
                    
                    // Skip empty lines but don't break on them
                    if (prevLine === '') continue;
                    
                    // Break on message separator or other directives (but not .embed:json)
                    if (prevLine === '.' || (prevLine.startsWith('.') && !prevLine.startsWith('.embed:json'))) break;
                    
                    // Found end of JSON block, now collect it
                    if (prevLine.endsWith('}')) {
                        let braceCount = 0;
                        let jsonLines: string[] = [];
                        
                        for (let j = k; j >= 0; j--) {
                            const jsonLine = lines[j];
                            jsonLines.unshift(jsonLine);
                            
                            for (const char of jsonLine) {
                                if (char === '}') braceCount++;
                                if (char === '{') braceCount--;
                            }
                            
                            if (braceCount === 0 && jsonLine.trim().startsWith('{')) {
                                jsonBlock = jsonLines.join('\n').trim();
                                foundJsonBackwards = true;
                                break;
                            }
                        }
                        break;
                    }
                }
                
                // If no JSON found backwards, look forwards (original logic)
                if (!foundJsonBackwards) {
                    let braceCount = 0;
                    let inJson = false;
        
                    for (let j = i + 1; j < lines.length; j++) {
                        const jsonLine = lines[j];
                        if (!inJson) {
                            if (jsonLine.trim().startsWith('{')) {
                                inJson = true;
                            } else {
                                continue;
                            }
                        }
        
                        if (inJson) {
                            jsonBlock += jsonLine + '\n';
                            for (const char of jsonLine) {
                                if (char === '{') braceCount++;
                                if (char === '}') braceCount--;
                            }
        
                            if (braceCount === 0 && jsonBlock.trim()) {
                                i = j; // Skip to end of JSON block
                                break;
                            }
                        }
                    }
                }
                
                if (jsonBlock.trim()) {
                    let embedJson = jsonBlock.trim();
                    const blockCorrections: string[] = [];
                    let correctedJson = embedJson;
                    let embedStartLine = i + 1;

                    let iterations = 0;
                    const MAX_ITERATIONS = 10;
                    while(iterations < MAX_ITERATIONS) {
                        iterations++;
                        const errors: ParseError[] = [];
                        parseTree(correctedJson, errors, { allowTrailingComma: true });
                        if (errors.length === 0) break;

                        const error = errors[0];
                        let fixed = false;
                        if (error.error === 6) { // Comma expected
                            // Add comma if we're after a value (number, string, object, array) and before whitespace or property name
                            const charBefore = correctedJson.charAt(error.offset - 1);
                            const charAt = correctedJson.charAt(error.offset);
                            
                            if (charBefore.match(/[0-9"}\]]/) || charAt.match(/\s/) || charAt === '"') {
                                correctedJson = correctedJson.slice(0, error.offset) + ',' + correctedJson.slice(error.offset);
                                blockCorrections.push('Added missing comma in JSON syntax');
                                fixed = true;
                            }
                        }
                        if (!fixed) break;
                    }

                const finalErrors: ParseError[] = [];
                const root = parseTree(correctedJson, finalErrors);

                if (!root || finalErrors.length > 0) {
                    const firstError = finalErrors[0] || { offset: 0, error: -1 };
                        const { line: errorLine, column } = this.getLineAndColumn(correctedJson, firstError.offset);
                    const errorType = getErrorMessageForCode(firstError.error);
                        const summary = `Error: ${errorType} at line ${errorLine}, column ${column}.`;
                     allParsingErrors.push({
                        description: `${embedStartLine}`,
                            correctedCode: `${summary}\n\`\`\`json\n${correctedJson}\n\`\`\``
                        });
                    } else {
                        let embedData = getNodeValue(root);

                        if (embedData && typeof embedData === 'object' && 'embed' in embedData) {
                            embedData = embedData.embed;
                        }

                const { correctedData, corrections: structuralCorrections } = this.validateAndCorrectEmbedStructure(embedData);
                blockCorrections.push(...structuralCorrections);
                
                        // Only show corrections if there are actual issues found
                if (blockCorrections.length > 0) {
                            // For syntax corrections, show the corrected JSON string
                            // For structural corrections, reconstruct from parsed data
                            const hadJsonSyntaxCorrections = correctedJson !== embedJson;
                            
                            let correctedJsonFormatted;
                            if (hadJsonSyntaxCorrections) {
                                // Format the syntax-corrected JSON nicely
                                try {
                                    const parsed = JSON.parse(correctedJson);
                                    correctedJsonFormatted = JSON.stringify(parsed, null, 2);
                                } catch {
                                    correctedJsonFormatted = correctedJson;
                                }
                            } else {
                                // Only structural corrections, reconstruct with corrected data
                                const originalData = getNodeValue(root);
                                if (originalData && typeof originalData === 'object' && 'embed' in originalData) {
                                    const correctedWithWrapper = { embed: correctedData };
                                    correctedJsonFormatted = JSON.stringify(correctedWithWrapper, null, 2);
                                } else {
                                    correctedJsonFormatted = JSON.stringify(correctedData, null, 2);
                                }
                            }
                            
                            const summary = `The following issues were found and fixed:\n- ${blockCorrections.join('\n- ')}`;
                    allParsingErrors.push({
                        description: `${embedStartLine}`,
                                correctedCode: `${summary}\n\n**Corrected segment:**\n\`\`\`json\n${correctedJsonFormatted}\n\`\`\``
                    });
                }
                        // If no corrections needed, don't add to allParsingErrors at all
                
                currentMessage.embeds.push(correctedData);
                currentMessage.rawEmbeds?.push(correctedJson);
                    }
                }
                continue;
            }

            // Check if this line starts a JSON block (for standalone JSON without .embed:json)
            if (trimmedLine.startsWith('{')) {
                let jsonBlock = '';
                let braceCount = 0;
                let jsonStartLine = i;
                
                // Collect the entire JSON block
                for (let j = i; j < lines.length; j++) {
                    const jsonLine = lines[j];
                    jsonBlock += jsonLine + '\n';
                    
                    for (const char of jsonLine) {
                        if (char === '{') braceCount++;
                        if (char === '}') braceCount--;
                    }
                    
                    if (braceCount === 0) {
                        // Check if next line is .embed:json
                        if (j + 1 < lines.length && lines[j + 1].trim() === '.embed:json') {
                            // Skip the JSON block here, it will be processed when we hit .embed:json
                            i = j; // Move to just before .embed:json line (loop will increment)
                            break;
            } else {
                            // Treat as regular content
                            currentMessage.content += (currentMessage.content ? '\n' : '') + jsonBlock.trim();
                            i = j;
                            break;
                }
            }
                }
                continue;
            }

            if (trimmedLine === '.') {
                finalizeCurrentMessage();
                continue;
            }
            
            currentMessage.content += (currentMessage.content ? '\n' : '') + line;
        }
        
        finalizeCurrentMessage();

        if (allParsingErrors.length > 0) {
            throw new ParsingError("File processing completed with corrections.", allParsingErrors);
        }

        return messages;
    }

    private hasLinkPlaceholder(text: string): boolean {
        return /\$linkmsg_([^$]+)\$/.test(text);
    }

    private resolvePlaceholders(text: string, tagMap: Map<string, string>, dynamicData: { channelId: string }): string {
        if (!text) return text;
    
        let resolvedText = text.replace(/\{\{channel:id\}\}/g, dynamicData.channelId);

        const linkPlaceholderRegex = /\$linkmsg_([^$]+)\$/g;
        resolvedText = resolvedText.replace(linkPlaceholderRegex, (match, tagName) => {
            return tagMap.get(tagName) || match;
        });
    
        return resolvedText;
    }

    private convertEmbedEmojis(embed: any, interaction: ChatInputCommandInteraction): any {
        if (!embed || typeof embed !== 'object') return embed;
        // Deep copy to avoid modifying the original object
        const newEmbed = JSON.parse(JSON.stringify(embed));
    
        const convert = (text: string) => text ? this.convertEmojis(text, interaction) : text;
    
        if (newEmbed.title) newEmbed.title = convert(newEmbed.title);
        if (newEmbed.description) newEmbed.description = convert(newEmbed.description);
        if (newEmbed.author?.name) newEmbed.author.name = convert(newEmbed.author.name);
        if (newEmbed.footer?.text) newEmbed.footer.text = convert(newEmbed.footer.text);
        if (Array.isArray(newEmbed.fields)) {
            newEmbed.fields.forEach((field: any) => {
                if (field.name) field.name = convert(field.name);
                if (field.value) field.value = convert(field.value);
            });
        }
    
        return newEmbed;
    }

    private convertEmojis(text: string, interaction: ChatInputCommandInteraction): string {
        if (!text) return text;
        const customEmojiRegex = /(?<!\w):([a-zA-Z0-9_]+):(?!\w)/g;
        return text.replace(customEmojiRegex, (match, emojiName) => {
            const emoji = this.client.emojis.cache.find(e => e.name === emojiName);
            return emoji ? emoji.toString() : match;
        });
    }

    private getLineAndColumn(json: string, offset: number): { line: number; column:number } {
        const textToOffset = json.substring(0, offset);
        const lines = textToOffset.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        return { line, column };
    }

    private validateAndCorrectEmbedStructure(embedData: any): { correctedData: any, corrections: string[] } {
        const correctedData = JSON.parse(JSON.stringify(embedData));
        const corrections: string[] = [];

        const validateUrlField = (field: any, fieldName: string) => {
            if (typeof field === 'string') {
                correctedData[fieldName] = { url: field };
                corrections.push(`Corrected \`${fieldName}\`: Changed from a simple string to an object \`{ "url": "${field}" }\`.`);
                }
        };

        if (correctedData.thumbnail) validateUrlField(correctedData.thumbnail, 'thumbnail');
        if (correctedData.image) validateUrlField(correctedData.image, 'image');
        if (correctedData.author) validateUrlField(correctedData.author, 'author');
        
        return { correctedData, corrections };
    }

    private splitLongMessage(message: string, maxLength = 1900): string[] {
        if (message.length <= maxLength) {
            return [message];
        }
        const chunks = [];
        let currentChunk = '';
        const sentences = message.split(/(?<=\.|\?|!)\s/);
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length <= maxLength) {
                currentChunk += sentence;
            } else {
                chunks.push(currentChunk);
                currentChunk = sentence;
            }
        }
            chunks.push(currentChunk);
        return chunks;
    }

    private levenshteinDistance(s1: string, s2: string): number {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
    
        const track = Array(s2.length + 1).fill(null).map(() =>
            Array(s1.length + 1).fill(null)
        );
    
        for (let i = 0; i <= s1.length; i++) {
            track[0][i] = i;
        }
        for (let j = 0; j <= s2.length; j++) {
            track[j][0] = j;
        }
    
        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator // substitution
                );
            }
        }
        return track[s2.length][s1.length];
    }

    private findBestMatch(tag: string, availableTags: Set<string>): string | null {
        if (availableTags.size === 0) return null;
    
        let bestMatch: string | null = null;
        let minDistance = Infinity;
    
        for (const availableTag of availableTags) {
            const distance = this.levenshteinDistance(tag, availableTag);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = availableTag;
            }
        }
    
        // A match is considered good if its distance is less than half the length
        // of the correct tag. This is a simple heuristic to avoid wildly wrong suggestions.
        if (bestMatch && minDistance <= bestMatch.length / 2) {
            return bestMatch;
        }
    
        return null;
    }
} 
