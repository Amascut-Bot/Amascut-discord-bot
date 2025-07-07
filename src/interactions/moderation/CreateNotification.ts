import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, AutocompleteInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, CacheType, ModalSubmitInteraction } from 'discord.js';
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
        // If the file doesn't exist or is invalid, start with an empty object
        return {};
    }
}

const roleNameToIdMap: { [name: string]: string } = {
    'Requires Reaper': '922821871639085057',
    'Notify: Learner': '458348038713376778',
    'Verified Learner': '935257969552142339'
};

export default class CreateNotification extends BotInteraction {
    get name() {
        return 'createnotif';
    }

    get description() {
        return 'Creates a new notification template.';
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
                    .setDescription('The unique name for this notification template.')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('target')
                    .setDescription('The target audience for the notification.')
                    .setRequired(true)
                    .setAutocomplete(true))
            .addStringOption(option =>
                option.setName('ping_role')
                    .setDescription('The role to ping when the notification is sent.')
                    .setRequired(false)
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices: string[] = [];

        if (focusedOption.name === 'target') {
            choices = ['Learners', 'Reapers'];
        }

        if (focusedOption.name === 'ping_role') {
            choices = ['Requires Reaper', 'Notify: Learner', 'Verified Learner'];
        }

        const filtered = choices.filter(choice => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice })),
        );
    }

    async run(interaction: ChatInputCommandInteraction) {
        const modal = new ModalBuilder()
            .setCustomId(`createnotif_modal_${interaction.id}`)
            .setTitle('Create Notification Embed');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel("Title")
            .setPlaceholder("Optional: The main title of the embed.")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel("Description")
            .setPlaceholder("Optional: The main body of the embed. Supports standard Discord markdown.")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        const footerInput = new TextInputBuilder()
            .setCustomId('footer')
            .setLabel("Footer")
            .setPlaceholder("Optional: A small line of text at the bottom of the embed.")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const imageInput = new TextInputBuilder()
            .setCustomId('image')
            .setLabel("Image URL")
            .setPlaceholder("Optional: A valid URL (https://...) for a large image at the bottom of the embed.")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const thumbnailInput = new TextInputBuilder()
            .setCustomId('thumbnail')
            .setLabel("Thumbnail URL")
            .setPlaceholder("Optional: A valid URL (https://...) for a small image in the top-right corner.")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput);
        const thirdActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(footerInput);
        const fourthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(imageInput);
        const fifthActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(thumbnailInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

        await interaction.showModal(modal);

        let modalInteraction: ModalSubmitInteraction<CacheType>;
        try {
            modalInteraction = await interaction.awaitModalSubmit({
                time: 300_000,
                // Make sure we only collect the modal interaction with the correct custom id
                filter: i => i.customId === `createnotif_modal_${interaction.id}`
            });
        } catch (err) {
            return;
        }

        const notificationName = interaction.options.getString('notification_name', true).toLowerCase().replace(/\s+/g, '_');
        const target = interaction.options.getString('target', true);
        const pingRoleName = interaction.options.getString('ping_role');

        const roleIdToSave = pingRoleName ? roleNameToIdMap[pingRoleName] : null;

        const embedData = {
            title: modalInteraction.fields.getTextInputValue('title') || undefined,
            description: modalInteraction.fields.getTextInputValue('description') || undefined,
            footer: modalInteraction.fields.getTextInputValue('footer') || undefined,
            image: modalInteraction.fields.getTextInputValue('image') || undefined,
            thumbnail: modalInteraction.fields.getTextInputValue('thumbnail') || undefined,
        };

        const newNotification: Notification = {
            target: target,
            pingRoleId: roleIdToSave,
            embed: embedData
        };

        try {
            const notifications = await readNotificationsFile();
            if (notifications[notificationName]) {
                await modalInteraction.reply({ content: `A notification template with the name "${notificationName}" already exists. Please choose a unique name.`, ephemeral: true });
                return;
            }

            notifications[notificationName] = newNotification;
            await fs.writeFile(notificationsFilePath, JSON.stringify(notifications, null, 4));

            await modalInteraction.reply({ content: `Successfully created the notification template: **${notificationName}**.`, ephemeral: true });

        } catch (error) {
            this.client.logger.error({ message: 'Failed to save notification template.', error: error });
            await modalInteraction.reply({ content: 'An error occurred while saving the notification template.', ephemeral: true });
        }
    }
} 