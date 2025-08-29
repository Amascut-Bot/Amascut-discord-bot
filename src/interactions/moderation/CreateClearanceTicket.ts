import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import TicketHandler from '../../modules/TicketHandler';

export default class CreateClearanceTicket extends BotInteraction {

    get name() {
        return 'create-clearance-ticket';
    }

    get description() {
        return 'Open a Ticket to discuss with reported user';
    }

    get permissions() {
        return 'ADMIN';
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
        return new TicketHandler(this.client, 'slashcommand', interaction);
    }
}
