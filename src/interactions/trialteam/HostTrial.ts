import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, MessageFlags } from 'discord.js';
import HostHandler from '../../modules/HostHandler';

export default class HostTrial extends BotInteraction {
    get name() {
        return 'host-trial';
    }

    get description() {
        return 'Set up a Trial Host Card';
    }

    get permissions() {
        return 'TRIAL_TEAM';
    }

    get enrageOptions() {
        const enrage: any = {
            'Enrage Mode - 500%': '500',
            'Enrage Mode - 1000%': '1000',
            'Enrage Mode - 2000%': '2000',
        }
        const options: any = [];
        Object.keys(enrage).forEach((key: string) => {
            options.push({ name: key, value: enrage[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('mode').setDescription('Enrage').setChoices(...this.enrageOptions).setRequired(true))
            .addStringOption((option) => option.setName('message').setDescription('Add a Message').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const mode: string = interaction.options.getString('mode', true);
        const message: string | null = interaction.options.getString('message', false);
        const formattedMessage = message ? `## Trial\\n${message}` : null;

        const learnerHostChannel = await interaction.guild?.channels.fetch(this.client.channelIds.trialHosts) as TextChannel;

        const success = await HostHandler.postHost(learnerHostChannel, mode, formattedMessage, null, [interaction.user.id], null, 2);

        const container = this.client.cv2.getContainerBuilder(success, "Host card creation");
        container.addTextDisplayComponents(builder => builder.setContent(success ? "Your host has been successfully created!" : "Your host could not be created!"));

        return await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
    }
}
