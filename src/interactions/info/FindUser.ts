import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, Role, EmbedBuilder, MessageFlags, User, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize } from 'discord.js';
import { Ticket } from '../../entity/Ticket';
import TicketHandler from '../../modules/TicketHandler';

export default class FindUser extends BotInteraction {

    get name() {
        return 'find-user';
    }

    get description() {
        return 'Find a User by it\' name';
    }

    get permissions() {
        return "ELEVATED_ROLE";
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

        let user = (await interaction.guild?.members.fetch())?.find(usr => usr.nickname === name || usr.displayName === name || usr.user.username === name);

        if (!user) {
            user = (await interaction.guild?.members.fetch())?.find(usr => usr.nickname?.toLowerCase() === name.toLowerCase() || usr.displayName.toLowerCase() === name.toLowerCase() || usr.user.username.toLowerCase() === name.toLowerCase());
        }

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
}
