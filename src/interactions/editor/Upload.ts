import BotInteraction from '../../types/BotInteraction';
import { Attachment, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, ChannelType, MessageFlags, GuildMember } from 'discord.js';
import UploadHandler from '../../modules/UploadHandler';
import ParsingError from '../../modules/UploadHandler';

export default class Upload extends BotInteraction {
    get name() {
        return 'upload';
    }

    get description() {
        return 'Upload and parse a text file to send as Discord messages';
    }

    get permissions() {
        return 'EDITOR';
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
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread)
            );
    }

    async run(interaction: ChatInputCommandInteraction<'cached'>) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const member: GuildMember = await interaction.member.fetch(true);
        const memberEditorRole = member.roles.cache.get(this.client.roleIds?.editor);
        const isAdmin = member.roles.cache.some(role => role.id === this.client.roleIds.owner || role.id === this.client.roleIds.admin);
        const stagingCategory: string = this.client.channelIds?.editorHub!;
        const attachment: Attachment | null = interaction.options.getAttachment('file', true);
        const targetChannel = (interaction.options.getChannel('channel', false) || interaction.channel) as TextChannel;

        // check if the channel has a parent, if not then crash :)
        const parentCategory: string | null = targetChannel.parentId;
        if (!parentCategory && !isAdmin) {
            return await interaction.editReply({ content: 'The channel you selected has no parent category.' })
        }

        // -- START check attachments --
        if (!attachment) {
            return await interaction.editReply({ content: 'No file was provided.' });
        }

        if (!targetChannel || !('send' in targetChannel)) {
            return await interaction.editReply({
                content: 'Invalid channel selected. Please choose a text channel.'
            });
        }

        if (!attachment.name?.endsWith('.txt') || !attachment.contentType?.includes('text/plain')) {
            return await interaction.editReply({
                content: 'Please upload a valid text file (.txt).'
            });
        }

        if (attachment.size > 5 * 1024 * 1024) {
            return await interaction.editReply({
                content: 'File is too large. Please upload a file smaller than 5MB.'
            });
        }
        // -- END check attachments --

        // (bypass for admins)The editor role can only use /upload to the staging guide category
        if (!isAdmin && parentCategory !== stagingCategory && memberEditorRole) {
            return await interaction.editReply({ content: 'You do not have permissions to post guides here.' })
        }

        try {
            const uploadHandler = new UploadHandler(this.client);

            await uploadHandler.uploadFile(targetChannel, attachment, interaction);

            // If we get here, everything was successful with no corrections needed
            await interaction.editReply({ content: 'Your file has been uploaded successfully!' });

        } catch (error: any) {
            if (error instanceof ParsingError) {
                await interaction.editReply({ content: 'Your file had some issues that were corrected. Check the details below.' });

                const uploadHandler = new UploadHandler(this.client);

                for (const e of error.errors) {
                    const summary = e.summary;
                    const correctedCode = e.correctedCode;

                    const chunks = uploadHandler.splitMessage(correctedCode);

                    if (chunks.length > 0) {
                        await interaction.followUp({
                            content: `**${summary}**\n\n**Corrected file:**\n\`\`\`json\n${chunks[0]}\n\`\`\``,
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    for (let i = 1; i < chunks.length; i++) {
                        await interaction.followUp({
                            content: `\`\`\`json\n${chunks[i]}\n\`\`\``,
                            flags: MessageFlags.Ephemeral,
                        });
                    }
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
}
