import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, MessageFlags, User } from 'discord.js';
import HostHandler from '../../modules/HostHandler';

export default class HostLearner extends BotInteraction {
    get name() {
        return 'host-learner';
    }

    get description() {
        return 'Set up a learner Host Card';
    }

    get enrageOptions() {
        const enrage: any = {
            'Normal Mode': 'nm',
            'Enrage Mode - 100%': '100',
            'Enrage Mode - 500%': '500',
            'Enrage Mode - 750%': '750',
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
            .addStringOption((option) => option.setName('mode').setDescription('Mode and Enrage').setChoices(...this.enrageOptions).setRequired(true))
            .addUserOption((option) => option.setName('learner').setDescription('Learner to host for').setRequired(true))
            .addStringOption((option) => option.setName('message').setDescription('Add a Message').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const mode: string = interaction.options.getString('mode', true);
        const message: string | null = interaction.options.getString('message', false);
        const learner: User = interaction.options.getUser('learner', true);

        const channel = interaction.channel as TextChannel;

        const success = await HostHandler.postHost(channel, mode, message, learner.id, interaction.user.id);

        const container = this.client.cv2.getContainerBuilder(success, "Host card creation");
        container.addTextDisplayComponents(builder => builder.setContent(success ? "Your host has been successfully created!" : "Your host could not be created!"));

        return await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
    }
}
