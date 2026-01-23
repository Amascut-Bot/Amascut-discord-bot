import BotInteraction from '../../types/BotInteraction';
import { ApplicationCommandType, ContextMenuCommandBuilder, UserContextMenuCommandInteraction } from 'discord.js';
import TicketHandler from '../../modules/TicketHandler';

export default class ContextCreateClearanceTicket extends BotInteraction {

    get name() {
        return 'create clearance ticket';
    }

    get permissions() {
        return 'ADMIN';
    }

    get contextCommandData() {
        return new ContextMenuCommandBuilder()
            .setName(this.name)
            .setType(ApplicationCommandType.User);
    }

    async run(interaction: UserContextMenuCommandInteraction) {
        return new TicketHandler(this.client, 'contextcommand', interaction);
    }
}
