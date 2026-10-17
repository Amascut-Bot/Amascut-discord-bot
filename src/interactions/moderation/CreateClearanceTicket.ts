import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';

export default class CreateClearanceTicket extends BotInteraction {

    get name() {
        return 'create-clearance-ticket';
    }

    get enabled() {
        return false;
    }

    get description() {
        return 'Open a Ticket to discuss with reported user';
    }

    get permissions() {
        return 'MOD';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption((option) => option.setName('reporteduser').setDescription('Reported User').setRequired(true))
            .addStringOption((option) => option.setName('rsn').setDescription('Reported Users RSN').setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Report Description').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        return interaction.reply({
            content: 'This command is currently disabled.',
            flags: MessageFlags.Ephemeral
        });
    }
}
