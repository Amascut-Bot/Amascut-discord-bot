import HostHandler from '../../modules/HostHandler';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default class FinishLoreBook extends BotInteraction {
    get name() {
        return 'finish-lorebook';
    }

    get description() {
        return 'Finish a Lore Book kill';
    }

    get permissions() {
        return 'LOREBOOK';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        return new HostHandler(this.client, 'host_lorebook_quickfinish', interaction);
    }
}
