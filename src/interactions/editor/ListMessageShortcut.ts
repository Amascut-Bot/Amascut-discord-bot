import { MessageShortcut } from '../../entity/MessageShortcut';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default class ListMessageShortcut extends BotInteraction {
    get name() {
        return 'list-message-shortcut';
    }

    get description() {
        return 'Lists all message shortcuts for your server!';
    }

    get permissions() {
        return 'EDITOR';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        if (!interaction.inCachedGuild()) {
            return await interaction.editReply('Command only allowed in guilds!');
        }

        const { dataSource } = this.client;
        const repository = dataSource.getRepository(MessageShortcut);

        const existingEntries = await repository.find({
            where: {
                guildId: interaction.guild!.id
            }
        });

        if (existingEntries?.length > 0) {
            let message = '';

            existingEntries.forEach(entry => {
                const url = `https://discord.com/channels/${entry.message_guildId}/${entry.message_channelId}/${entry.message_messageId}`;
                const shortcut = `\`${entry.shortcut}\``;

                message += `Shortcut: ${shortcut} linking to Message: ${url}\n`;
            });

            message = message.trim();
            return await interaction.editReply(message);
        } else {
            return await interaction.editReply('No shortcuts for your server defined at the moment');
        }
    }
}
