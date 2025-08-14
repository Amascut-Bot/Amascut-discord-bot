import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, Role, EmbedBuilder, MessageFlags, User, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize } from 'discord.js';
import { Ticket } from '../../entity/Ticket';
import TicketHandler from '../../modules/TicketHandler';

export default class CreateClearanceTicket extends BotInteraction {

    get name() {
        return 'create-clearance-ticket';
    }

    get description() {
        return 'Open a Ticket to discuss with reported user';
    }

    get permissions() {
        return "ELEVATED_ROLE";
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption((option) => option.setName('reporteduser').setDescription('Reported user').setRequired(true))
            .addStringOption((option) => option.setName('rsn').setDescription('Reported Users RSN').setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Report Description').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        return new TicketHandler(this.client, 'slashcommand', interaction);
    }
}
