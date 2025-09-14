import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags, ContainerComponent, TextDisplayBuilder, TextDisplayComponent } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import ComponentsV2Utils from '../../modules/ComponentsV2Utils';

export default class EnrageEdit extends BotInteraction {
    get name() {
        return 'enrage-edit';
    }

    get description() {
        return 'Edit an Enrage-Leaderboard Submission';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('messageid').setDescription('Message-ID of the Submission to edit').setRequired(true))
            .addNumberOption((option) => option.setName('enrage').setDescription('Enrage to set').setRequired(false))
            .addStringOption((option) => option.setName('rsn1').setDescription('RSN of Group Member #1').setRequired(false))
            .addStringOption((option) => option.setName('rsn2').setDescription('RSN of Group Member #2').setRequired(false))
            .addStringOption((option) => option.setName('rsn3').setDescription('RSN of Group Member #3').setRequired(false))
            .addStringOption((option) => option.setName('rsn4').setDescription('RSN of Group Member #4').setRequired(false))
            .addStringOption((option) => option.setName('rsn5').setDescription('RSN of Group Member #5').setRequired(false))
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) return interaction.editReply('Command only available in guilds!');

        const rsn1: string | null = interaction.options.getString('rsn1', false);
        const rsn2: string | null = interaction.options.getString('rsn2', false);
        const rsn3: string | null = interaction.options.getString('rsn3', false);
        const rsn4: string | null = interaction.options.getString('rsn4', false);
        const rsn5: string | null = interaction.options.getString('rsn5', false);

        const enrage: number | null = interaction.options.getNumber('enrage', false);

        const messageid: string = interaction.options.getString('messageid', true);

        const submissionChannelId = this.client.channelIds.leaderboardSubmission;
        const submissionChannel = await interaction.guild!.channels.fetch(submissionChannelId) as TextChannel;

        const message = await submissionChannel.messages.fetch(messageid);
        const messageComponents = (message.components[0] as ContainerComponent).components;
        const container = ComponentsV2Utils.cleanContainer(message.components[0]);

        let value = (messageComponents[0] as TextDisplayComponent).content;

        if (enrage && enrage > 0) {
            value = value.replace(/(Submitted Enrage:\s*`)\d+%(`)/, `$1${enrage}%$2`);
        }

        if (rsn1 && rsn1 !== null) {
            value = value.replace(/(1:\s*RSN:\s*`)([^`]+)(`)/, `$1${rsn1}$3`);
        }

        if (rsn2 && rsn2 !== null) {
            value = value.replace(/(2:\s*RSN:\s*`)([^`]+)(`)/, `$1${rsn2}$3`);
        }

        if (rsn3 && rsn3 !== null) {
            value = value.replace(/(3:\s*RSN:\s*`)([^`]+)(`)/, `$1${rsn3}$3`);
        }

        if (rsn4 && rsn4 !== null) {
            value = value.replace(/(4:\s*RSN:\s*`)([^`]+)(`)/, `$1${rsn4}$3`);
        }

        if (rsn5 && rsn5 !== null) {
            value = value.replace(/(5:\s*RSN:\s*`)([^`]+)(`)/, `$1${rsn5}$3`);
        }

        (container.components[0] as TextDisplayBuilder) = new TextDisplayBuilder().setContent(value);
        await message.edit( { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { "parse": [] } });

        await interaction.editReply('Edit successfull.');
    }
}
