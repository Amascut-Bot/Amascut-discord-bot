import { MessageShortcut } from '../../entity/MessageShortcut';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, Role, MessageFlags, APIRole, RoleCreateOptions, PermissionsBitField, PermissionFlagsBits, TextChannel } from 'discord.js';

export default class ManageMessageShortcut extends BotInteraction {
    get name() {
        return 'manage-message-shortcut';
    }

    get description() {
        return 'Create, Delete or Update a message shortcut for your server!';
    }

    get permissions() {
        return 'ELEVATED_ROLE';
    }

    get operation() {
        const vals: any = {
            'Add': 'add',
            'Remove': 'remove',
            //'Update': 'update',
        }
        const options: any = [];
        Object.keys(vals).forEach((key: string) => {
            options.push({ name: key, value: vals[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('operation').setDescription('Add, Remove').addChoices(...this.operation).setRequired(true))
            .addStringOption((option) => option.setName('messagelink').setDescription('Link to the Message').setRequired(false))
            .addStringOption((option) => option.setName('shortcut').setDescription(`Shortcut for this message. E.g. '!faq'`).setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            return await interaction.editReply('Command only allowed in guilds!');
        }

        const operation = interaction.options.getString('operation', true);
        const messageLink: string | null = interaction.options.getString('messagelink', false) ?? '';
        const shortcut: string | null = interaction.options.getString('shortcut', false) ?? '';

        const { dataSource } = this.client;
        const repository = dataSource.getRepository(MessageShortcut);

        // update: not supported yet

        const match = messageLink?.match(/^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/);

        if (operation === 'add') {
            // add: message and shortcut need to be filled
            if (messageLink === '' || shortcut === '' || !match) {
                return await interaction.editReply('To add a new shortcut you need to provide a Message-Link and a shortcut alias.');
            }

            // shortcut can't exist yet
            const existingEntry = await repository.findOne({
                where: {
                    guildId: interaction.guild!.id,
                    shortcut: shortcut
                }
            });

            if (existingEntry) {
                return await interaction.editReply(`There is already a shortcut '${shortcut}' existing.`);
            }

            // create new shortcut
            const shortcutObject = new MessageShortcut();
            shortcutObject.guildId = interaction.guild!.id;
            shortcutObject.shortcut = shortcut!;
            shortcutObject.message_guildId = match![1];
            shortcutObject.message_channelId = match![2];
            shortcutObject.message_messageId = match![3];

            await repository.save(shortcutObject);
            return await interaction.editReply(`Successfully created shortcut '${shortcut}' for message ${messageLink}.`);

        } else if (operation === 'remove') {
            // remove: either message or shortcut need to be filled, will delete based on whats found for its values
            if ((messageLink === '' || !match) && shortcut === '') {
                return await interaction.editReply('U need to at least provide a shortcut or messagelink, whose shortcuts you want to delete!');
            }

            if (shortcut !== '') {
                const existingEntry = await repository.findOne({
                    where: {
                        guildId: interaction.guild!.id,
                        shortcut: shortcut
                    }
                });

                if (existingEntry) {
                    await repository.delete(existingEntry);
                    return await interaction.editReply(`Successfully deleted shortcut '${shortcut}'.`);
                }
            }

            if (messageLink !== '' && match) {
                const existingEntries = await repository.find({
                    where: {
                        guildId: interaction.guild!.id,
                        message_guildId: match[1],
                        message_channelId: match[2],
                        message_messageId: match[3]
                    }
                });

                if (existingEntries) {
                    await repository.delete(existingEntries);
                    return await interaction.editReply(`Successfully deleted all shortcuts referencing ${messageLink}.`);
                }
            }

            return await interaction.editReply(`Couldn't find a shortcut for '${shortcut}' or ${messageLink} to delete.`);
        }
    }
}
