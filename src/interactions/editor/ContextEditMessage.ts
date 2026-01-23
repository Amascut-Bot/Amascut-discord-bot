import BotInteraction from '../../types/BotInteraction';
import * as uuid from 'uuid';
import { ApplicationCommandType, ContextMenuCommandBuilder, FileUploadBuilder, MessageContextMenuCommandInteraction, MessageFlags, ModalBuilder, ModalSubmitInteraction } from 'discord.js';
import UploadHandler from '../../modules/UploadHandler';

export default class ContextEditMessage extends BotInteraction {

    get name() {
        return 'edit message';
    }

    get permissions() {
        return 'EDITOR';
    }

    get contextCommandData() {
        return new ContextMenuCommandBuilder()
            .setName(this.name)
            .setType(ApplicationCommandType.Message);
    }

    async run(interaction: MessageContextMenuCommandInteraction) {
        // check if message is from me so i can edit it
        if (interaction.targetMessage.author.id != this.client.user?.id) {
            return await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `You can only edit messages posted by <@${this.client.user?.id}>`
            });
        }

        // grab content to edit
        const genid = uuid.v4()

        const modal = new ModalBuilder()
            .setCustomId(`edit-message-modal-${genid}`)
            .setTitle('Edit Message');

        // file
        const fileUpload = new FileUploadBuilder()
            .setCustomId('attachment')
            .setRequired(true)
            .setMaxValues(1);

        modal.addLabelComponents(label => label
            .setLabel('File')
            .setFileUploadComponent(fileUpload)
        );

        await interaction.showModal(modal);

        const filter = (i: ModalSubmitInteraction) => i.customId === `edit-message-modal-${genid}` && i.user.id === interaction.user.id;

        try {
            const uploadHandler = new UploadHandler(this.client);
            const modalInteraction = await interaction.awaitModalSubmit({ filter, time: 900_000 }); // 15 minutes

            const attachment = modalInteraction.fields.getUploadedFiles('attachment', true).first()!;

            // check attachment

            if (!attachment.name?.endsWith('.txt') || !attachment.contentType?.includes('text/plain')) {
                return await modalInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: 'Please upload a valid text file (.txt).'
                });
            }

            if (attachment.size > 5 * 1024 * 1024) {
                return await modalInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: 'File is too large. Please upload a file smaller than 5MB.'
                });
            }

            try {
                await uploadHandler.editMessage(interaction.targetMessage, attachment);
            } catch (err) {
                console.error('edit message error:', err);

                return await modalInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: `${err}`
                });
            }

            return await modalInteraction.reply({
                flags: MessageFlags.Ephemeral,
                content: 'Message successfully edited.'
            });
        } catch (err) {
            console.error('edit message error:', err);
        }
    }
}
