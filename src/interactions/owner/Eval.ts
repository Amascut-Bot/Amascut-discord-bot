import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandStringOption, EmbedBuilder } from 'discord.js';
// import { ApplicationCommandOptionType } from 'discord-api-types/v9';
import { inspect } from 'util';
import BotInteraction from '../../types/BotInteraction';

export default class Eval extends BotInteraction {
    get name() {
        return 'eval';
    }

    get description() {
        return 'Evaluate code in the scope of Eval#Class';
    }

    get permissions() {
        return 'OWNER';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option: SlashCommandStringOption) => option.setName('code').setDescription('Evaluate Code from interaction scope.').setRequired(true));
    }

    static trim(string: string, max: number): string {
        return string.length > max ? string.slice(0, max) : string;
    }

    async run(interaction: ChatInputCommandInteraction<any>) {
        await interaction.deferReply({ ephemeral: false });
        const code = interaction.options.getString('code', true);
        let res;
        try {
            res = await eval(code);
            res = inspect(res, { depth: 2 });
        } catch (error) {
            res = inspect(error, { depth: 2 });
        }
        const embed = new EmbedBuilder()
            .setColor(this.client.color)
            .setTitle('Eval Results')
            .setDescription(`\`\`\`js\n${Eval.trim(res, 4000)}\`\`\``)
            .setTimestamp()
            .setFooter({ text: this.client.user?.username ?? 'dejj', iconURL: this.client.user?.displayAvatarURL() });
        await interaction.editReply({ embeds: [embed] });
    }
}
