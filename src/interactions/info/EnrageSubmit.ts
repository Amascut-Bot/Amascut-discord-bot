import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags, User, Attachment } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import LeaderboardHandler from '../../modules/LeaderboardHandler';

export default class EnrageSubmit extends BotInteraction {
    get name() {
        return 'enrage-submit';
    }

    get description() {
        return 'Submit your Groups highest Enrage for leaderboard consideration.';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addNumberOption((option) => option.setName('enrage').setDescription('Enrage % you are submitting').setRequired(true))
            .addAttachmentOption((option) => option.setName('screenshot').setDescription('Screenshot showing every submitted player has the claimed enrage').setRequired(true))
            .addStringOption((option) => option.setName('rsn').setDescription('Your RuneScape Name').setRequired(true))
            .addStringOption((option) => option.setName('rsn2').setDescription('RSN of Group Member #2').setRequired(true))
            .addUserOption((option) => option.setName('disc2').setDescription('Discord Profile of Group Member #2').setRequired(true))
            .addStringOption((option) => option.setName('rsn3').setDescription('RSN of Group Member #3').setRequired(false))
            .addUserOption((option) => option.setName('disc3').setDescription('Discord Profile of Group Member #3').setRequired(false))
            .addStringOption((option) => option.setName('rsn4').setDescription('RSN of Group Member #4').setRequired(false))
            .addUserOption((option) => option.setName('disc4').setDescription('Discord Profile of Group Member #4').setRequired(false))
            .addStringOption((option) => option.setName('rsn5').setDescription('RSN of Group Member #5').setRequired(false))
            .addUserOption((option) => option.setName('disc5').setDescription('Discord Profile of Group Member #5').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) return interaction.editReply('Command only available in guilds!');

        const rsn: string = interaction.options.getString('rsn', true);
        const rsn2: string = interaction.options.getString('rsn2', true);
        const rsn3: string | null = interaction.options.getString('rsn3', false);
        const rsn4: string | null = interaction.options.getString('rsn4', false);
        const rsn5: string | null = interaction.options.getString('rsn5', false);

        const disc: User = interaction.user;
        const disc2: User = interaction.options.getUser('disc2', true);
        const disc3: User | null = interaction.options.getUser('disc3', false);
        const disc4: User | null = interaction.options.getUser('disc4', false);
        const disc5: User | null = interaction.options.getUser('disc5', false);

        const enrage: number = interaction.options.getNumber('enrage', true);

        const attachment: Attachment = interaction.options.getAttachment('screenshot', true);

        if (!attachment.contentType?.includes('image')) return interaction.editReply('U need to attach an Image!');

        const submissionChannelId = this.client.channelIds.leaderboardSubmission;
        const submissionChannel = await interaction.guild!.channels.fetch(submissionChannelId) as TextChannel;

        const team: { rsn: string, disc: string }[] = [];

        team.push( { rsn: rsn, disc: disc.id });
        team.push( { rsn: rsn2, disc: disc2.id });

        if (rsn3 && disc3) team.push( { rsn: rsn3, disc: disc3.id });
        if (rsn4 && disc4) team.push( { rsn: rsn4, disc: disc4.id });
        if (rsn5 && disc5) team.push( { rsn: rsn5, disc: disc5.id });

        LeaderboardHandler.postLeaderboardSubmission(submissionChannel, this.client, interaction.user, team.map(x => x.rsn), team.map(x => x.disc), enrage, attachment.url, '');

        await interaction.editReply('You Enrage Submission was successfully created. Please wait for an Admin or Owner to review and approve / reject it.');
    }
}
