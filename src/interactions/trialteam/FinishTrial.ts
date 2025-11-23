import HostHandler from '../../modules/HostHandler';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export default class FinishTrial extends BotInteraction {
    get name() {
        return 'finish-trial';
    }

    get description() {
        return 'Finish a Trial';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        return new HostHandler(this.client, 'host_trial_quickfinish', interaction);
    }
}
