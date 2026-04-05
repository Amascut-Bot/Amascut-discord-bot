import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default class FindUser extends BotInteraction {

    get name() {
        return 'find-user';
    }

    get description() {
        return 'Find a User by it\' name';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('name').setDescription('Name').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        //await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.deferReply();

        const name = interaction.options.getString('name', true);
        await interaction.guild?.members.fetch().catch(() => { });

        // step 1: search by exact name match
        let user = interaction.guild?.members.cache?.find(usr => usr.nickname === name || usr.displayName === name || usr.user.username === name);

        // step 2: be more lenient - lowercase match
        if (!user) {
            user = interaction.guild?.members.cache?.find(usr => usr.nickname?.toLowerCase() === name.toLowerCase() || usr.displayName.toLowerCase() === name.toLowerCase() || usr.user.username.toLowerCase() === name.toLowerCase());
        }

        // step 3: if somehow they search a user by it's id?
        if (!user) {
            user = interaction.guild?.members.cache?.find(usr => usr.id === name);
        }

        // step 4: normalize the search-string and usernames
        if (!user) {
            const normalizedName = this.normalizeString(name);
            user = interaction.guild?.members.cache?.find(usr => this.normalizeString(usr.nickname) === normalizedName || this.normalizeString(usr.displayName) === normalizedName || this.normalizeString(usr.user.username) === normalizedName);
        }

        // step 5: levensthein / fuzzy / soundex maybe some day

        if (user) {
            const successEmbed = new EmbedBuilder()
                .setTitle(`Find User ${name}`)
                .setColor(this.client.util.colours.discord.green)
                .setDescription(`Found User: ${user.displayName}\n\nID: ${user.id}\n\nMention: <@${user.id}>\n\nCopy: \`\`\`<@${user.id}>\`\`\``);

            return await interaction.editReply({ embeds: [successEmbed] });
        } else {
            const errorEmbed = new EmbedBuilder()
                .setTitle(`Find User ${name}`)
                .setColor(this.client.util.colours.discord.red)
                .setDescription(`Could not find searched user`);

            return await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    //greetings from chatgpt
    private normalizeString(str: string | null) : string {
        if (str === null) return "";
        if (typeof str !== "string") return "";

        return str
            .normalize("NFD")                 // split accents from letters
            .replace(/[\u0300-\u036f]/g, "")  // remove diacritic marks
            .toLowerCase()                    // convert to lowercase
            .replace(/[^a-z0-9]/g, "")        // keep only letters + numbers
            .replace(/(.)\1+/g, "$1");        // collapse repeated chars (letters & numbers)
    }
}
