import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, MessageFlags } from 'discord.js';
import HostHandler from '../../modules/HostHandler';

export default class HostLoreBook extends BotInteraction {
    get name() {
        return 'host-lorebook';
    }

    get description() {
        return 'Set up a Lore Book Host Card';
    }

    get permissions() {
        return 'LOREBOOK';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('message').setDescription('Add a Message').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message: string | null = interaction.options.getString('message', false);
        const formattedMessage = message ? `## Lorebook\\n${message}` : null;

        const learnerHostChannel = await interaction.guild?.channels.fetch(this.client.channelIds.learnerHosts) as TextChannel;

        const success = await HostHandler.postHost(learnerHostChannel, 'nm', formattedMessage, null, [interaction.user.id], null, 1);

        const container = this.client.cv2.getContainerBuilder(success, "Host card creation");
        container.addTextDisplayComponents(builder => builder.setContent(success ? "Your host has been successfully created!" : "Your host could not be created!"));

        return await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });
    }
}
