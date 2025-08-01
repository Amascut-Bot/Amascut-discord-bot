import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface DropTableItem {
    name: string;
    quantity: number;
    isUnique: boolean;
    price: number;
}

interface DropTablePerVersion {
    [version: string]: BossRevenueData; //DropTableItem[];
}

interface BossRevenueData {
    regularGpPerKill: number;
    overallGpPerKill: number;
    killsPerHour: number;
    regularGpPerHour: number;
    overallGpPerHour: number;
    calculationTime: string;
}

interface CachedRevenueData extends BossRevenueData {
    cachedAt: number;
}

interface TrackedEmbed {
    messageId: string;
    channelId: string;
    guildId: string;
    postedAt: number;
}

interface BossConfig {
    kph: number;
    lastUpdated?: string;
    notes?: string;
    trackedEmbeds?: TrackedEmbed[];
}

export default class BossRevenueV2 extends BotInteraction {
    private static cache: CachedRevenueData | null = null;
    private static readonly CACHE_TTL = 7 * 60 * 1000;

    get name() {
        return 'boss-revenuevtwo';
    }

    get description() {
        return 'Calculate GP per kill and GP per hour for Raksha based on current prices';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral});
        const { colours } = this.client.util;

        try {
            const dropTablePerVersion: DropTablePerVersion = {};

            const telosVersions: string[] = ['2449 Enrage Claims', '999 Enrage Claims', '100 Enrage Claims'];
            const url = 'https://runescape.wiki/w/Money_making_guide/Killing_Telos,_the_Warden?action=edit';

            for (const version of telosVersions) {
                dropTablePerVersion[version] = await this.getCachedOrFreshData(version, url);
            }

            let description = '';
            const fields: any[] = [];

            telosVersions.forEach(version => {
                description += `## ${version}:\n`;
                description += `**Commons GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(dropTablePerVersion[version].regularGpPerKill).toLocaleString()}\` gp *(no uniques)*\n`;
                description += `**Total GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(dropTablePerVersion[version].overallGpPerKill).toLocaleString()}\` gp *(with uniques)*\n`;

                fields.push(
                    {
                        name: `## ${version}:\nGP/Hour (${dropTablePerVersion[version].killsPerHour} kph)`,
                        value: `<:Coins:1400432187924287579> ${Math.round(dropTablePerVersion[version].overallGpPerHour).toLocaleString()} gp`,
                        inline: false
                    }
                );
            });

            description = description.trim();

            const embed = new EmbedBuilder()
                .setColor(this.client.color)
                .setTitle('Telos - Wiki')
                .setURL('https://runescape.wiki/w/Telos,_the_Warden')
                .setThumbnail('https://runescape.wiki/images/thumb/Telos%2C_the_Warden.png/201px-Telos%2C_the_Warden.png?99e18')
                .setDescription(description)
                .addFields(fields);

            await interaction.editReply({ content: 'Embed sent!'});

            if (interaction.channel && 'send' in interaction.channel) {
                const message = await interaction.channel.send({ embeds: [embed] });
                await this.trackEmbed(message.id, interaction.channelId, interaction.guildId);
            }

        } catch (error) {
            this.client.logger.error({ message: 'Error calculating boss revenue', error });

            const errorEmbed = new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription('Failed to calculate boss revenue. Please try again later.');

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    private async getCachedOrFreshData(version: string, url: string): Promise<BossRevenueData> {
        const now = Date.now();
        const cache = BossRevenueV2.cache;

        if (cache && (now - cache.cachedAt) < BossRevenueV2.CACHE_TTL) {
            //return cache;
        }

        const freshData = await this.calculateRevenue(version, url);
        BossRevenueV2.cache = { ...freshData, cachedAt: now };
        return freshData;
    }

    private loadBossConfig(): BossConfig {
        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return configData.raksha || { kph: 20 };
        } catch (error) {
            return { kph: 20 };
        }
    }

    private async calculateRevenue(version: string, url: string): Promise<BossRevenueData> {
        const dropTable = await this.fetchDropTable(version, url);
        if (dropTable.length === 0) {
            throw new Error('Unable to fetch drop table data');
        }

        const config = this.loadBossConfig();
        const killsPerHour = config.kph;
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));
        const regularDrops = dropTable.filter(drop => !drop.isUnique);
        const uniqueDrops = dropTable.filter(drop => drop.isUnique);

        let regularValue = 0;
        for (const drop of regularDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined && price > 0) {
                const dropValue = (price * drop.quantity);
                regularValue += dropValue;
            } else if (drop.price > 0) {
                const dropValue = (drop.price * drop.quantity);
                regularValue += dropValue;
            }
        }

        let overallValue = regularValue;
        for (const drop of uniqueDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined && price > 0) {
                const dropValue = (price * drop.quantity);
                overallValue += dropValue;
            } else if (drop.price > 0) {
                const dropValue = (drop.price * drop.quantity);
                overallValue += dropValue;
            }
        }

        const regularGpPerKill = Math.round(regularValue);
        const overallGpPerKill = Math.round(overallValue);

        return {
            regularGpPerKill,
            overallGpPerKill,
            killsPerHour,
            regularGpPerHour: regularGpPerKill * killsPerHour,
            overallGpPerHour: overallGpPerKill * killsPerHour,
            calculationTime: new Date().toLocaleString()
        };
    }

    private async fetchDropTable(version: string, url: string): Promise<DropTableItem[]> {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Amascut Discord Bot - Boss Revenue Calculator'
                },
                timeout: 15000
            });

            return await this.parseBossDropTable(version, response.data);

        } catch (error) {
            return [];
        }
    }

    private async parseBossDropTable(version: string, html: string): Promise<DropTableItem[]> {
        const dropTable: DropTableItem[] = [];

        try {
            const allTablesRegex = new RegExp(`${version !== '' ? version + '=' : ''}\\s*(\\{\\{Mmgtable[\\s\\S]*?\\}\\}\n(?:\n|\\|\\-\\|))`, 'gis'); // /\{\{Mmgtable\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/gis
            const match = html.match(allTablesRegex);

            if (match) {
                dropTable.push(...await this.parseDropTable(match[0]));
            }

            return dropTable;
        } catch (error) {
            return [];
        }
    }

    private async parseDropTable(tableContent: string): Promise<DropTableItem[]> {
        const dropTable: DropTableItem[] = [];

        try {
            const outputItemNameRegex = /Output\d+\s*=\s*(.+)$/gm;
            const outputItemQuantityRegex = /Output\d+num\s*=\s*(.+)$/gm;
            const outputItemPriceRegex = /Output\d+value\s*=\s*(.+)$/gm;
            const defineLootPointsRegex = /Define variables = {{#vardefine:loot points\|(\d+)}}/gm;

            let value = tableContent;

            // line example {{DropsLine|name=Catalytic anima stone|quantity=40-60|rarity=12/100}}
            let splittedLine: string[] = value.split('|');
            const lootPointsArr: string[] = splittedLine.filter(val => val.startsWith('Define variables = {{#vardefine:loot points')) ?? [];
            let lootPoints = '0';

            if (lootPointsArr.length === 1) {
                const lootPointsMatch = defineLootPointsRegex.exec(lootPointsArr[0]);

                if (lootPointsMatch) {
                    lootPoints = lootPointsMatch[1];
                }
            }

            splittedLine = splittedLine.filter(val => val.startsWith('Output'));

            let item: DropTableItem = {
                name: '',
                quantity: 0,
                isUnique: false,
                price: 0
            };

            for (let index = 0; index < splittedLine.length; index++) {
                const entry = splittedLine[index];
                
                // check what type of output it is
                const itemNameMatch = outputItemNameRegex.exec(entry);
                const itemQuantityMatch = outputItemQuantityRegex.exec(entry);
                const itemPriceMatch = outputItemPriceRegex.exec(entry);

                // if it is itemname its a new entry
                if (itemNameMatch) {
                    //push the old entry first
                    if (index > 0) {
                        dropTable.push(item);
                    }

                    item = {
                        name: itemNameMatch[1],
                        quantity: 0,
                        isUnique: this.isUniqueItem(itemNameMatch[1]),
                        price: 0
                    };
                }

                if (itemQuantityMatch) {
                    item.quantity = this.extractQuantityFromCell(itemQuantityMatch[1].replace('{{#var:loot points}}', lootPoints));
                }

                if (itemPriceMatch) {
                    item.price = await this.extractPriceFromCell(itemPriceMatch[1]);
                }

                // if it is the last entry, push also
                if (index === splittedLine.length - 1) {
                    dropTable.push(item);
                }
            }

            return dropTable;
        } catch (error) {
            return [];
        }
    }

    private extractQuantityFromCell(cell: string): number {
        let val = cell.replace('{{#expr:', '');
        val = val.replace('}}', '');

        return eval(val);
    }

    private async extractPriceFromCell(cell: string): Promise<number> {
        try {
            console.log('Original cell:', cell);
            let processed = cell
                .replace(/\{GETotal¦/g, '(')
                .replace(/¦([+\-*/])¦/g, ' $1 ')
                .replace(/¦\}/g, ')')
                .replace(/\{cvexpr¦/g, '(')
                .replace(/\{\{GEP\|([^}]+)\}\}/g, '$1')
                .replace(/¦/g, '+')
                .replace(/\}/g, ')');
            console.log('After transformations:', processed);
            
            const itemMatches = [...processed.match(/[A-Z][A-Za-z0-9\s,''-]+?(?=\s*[\+\-\*\/\(\)]|$)/g) || []];
            if (itemMatches.length > 0) {
                console.log('Extracted items:', itemMatches);
                const prices = await this.getItemPrices(itemMatches);
                console.log('Item prices:', prices);
                
                const sortedItems = itemMatches.sort((a, b) => b.length - a.length);
                for (const item of sortedItems) {
                    const price = prices[item] || 0;
                    processed = processed.replace(new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), price.toString());
                }
            }
            console.log('After price substitution:', processed);
            
            const sanitized = processed.replace(/[^\d+\-*/.() ]/g, '');
            const result = new Function(`return ${sanitized}`)();
            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch (error) {
            console.log('Error parsing price cell:', cell, error);
            return 0;
        }
    }

    private isUniqueItem(itemName: string): boolean {
        const uniqueItems = [
            'Orb of pure anima', 'Orb of volcanic anima', 'Orb of corrupted anima',
            'Dormant staff of Sliske', 'Dormant Seren godbow', 'Dormant Zaros godsword',
            'Reprisal ability codex'
        ];
        return uniqueItems.some(unique => itemName.toLowerCase().includes(unique.toLowerCase()));
    }



    private async getItemPrices(itemNames: string[]): Promise<Record<string, number>> {
        const priceMap: Record<string, number> = {};
        const batchSize = 10;

        for (let i = 0; i < itemNames.length; i += batchSize) {
            const batch = itemNames.slice(i, i + batchSize);
            const itemQuery = batch.join('|');

            try {
                const response = await axios.get(
                    `https://api.weirdgloop.org/exchange/history/rs/latest?name=${encodeURIComponent(itemQuery)}`,
                    {
                        headers: {
                            'User-Agent': 'Amascut-Discord-Bot - Boss Revenue Calculator'
                        }
                    }
                );

                if (response.data) {
                    Object.entries(response.data).forEach(([itemName, priceData]: [string, any]) => {
                        if (priceData && typeof priceData.price === 'number') {
                            priceMap[itemName] = priceData.price;
                        }
                    });
                }
            } catch (error) {
                this.client.logger.error({ message: `Failed to fetch prices for batch: ${itemQuery}`, error });
            }
        }

        return priceMap;
    }



    private async trackEmbed(messageId: string, channelId: string, guildId: string | null): Promise<void> {
        if (!guildId) return;

        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            let configData: any = {};

            try {
                const configFile = fs.readFileSync(configPath, 'utf8');
                configData = JSON.parse(configFile);
            } catch (error) {
                configData = {};
            }

            if (!configData.raksha) {
                configData.raksha = { kph: 20, trackedEmbeds: [] };
            }
            if (!configData.raksha.trackedEmbeds) {
                configData.raksha.trackedEmbeds = [];
            }

            configData.raksha.trackedEmbeds = configData.raksha.trackedEmbeds
                .filter((embed: TrackedEmbed) => embed.guildId !== guildId)
                .concat(configData.raksha.trackedEmbeds.filter((embed: TrackedEmbed) => embed.guildId === guildId).slice(-4));

            configData.raksha.trackedEmbeds.push({
                messageId,
                channelId,
                guildId,
                postedAt: Date.now()
            });

            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));
        } catch (error) {
            this.client.logger.error({ message: 'Error tracking embed', error });
        }
    }

    private createEmbedFromData(revenueData: BossRevenueData): EmbedBuilder {
        return new EmbedBuilder()
            .setColor(this.client.color)
            .setTitle('Raksha - Wiki')
            .setURL('https://runescape.wiki/w/Raksha,_the_Shadow_Colossus')
            .setThumbnail('https://runescape.wiki/images/0/0a/Raksha%2C_the_Shadow_Colossus.png')
            .setDescription(
                `**Commons GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.regularGpPerKill).toLocaleString()}\` gp *(no uniques)*\n` +
                `**Total GP/Kill:** <:Coins:1400432187924287579> \`${Math.round(revenueData.overallGpPerKill).toLocaleString()}\` gp *(with uniques)*`
            )
            .addFields([
                {
                    name: `GP/Hour (${revenueData.killsPerHour} kph)`,
                    value: `<:Coins:1400432187924287579> ${Math.round(revenueData.overallGpPerHour).toLocaleString()} gp`,
                    inline: false
                }
            ]);
    }

    public async updateAllTrackedEmbeds(): Promise<void> {
        try {
            const configPath = path.join(process.cwd(), 'boss-configs.json');
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

            if (!configData.raksha?.trackedEmbeds) return;

            const revenueData = await this.getCachedOrFreshData('2449 Enrage Claims', 'https://runescape.wiki/w/Money_making_guide/Killing_Telos,_the_Warden?action=edit');
            const embed = this.createEmbedFromData(revenueData);

            const validEmbeds: TrackedEmbed[] = [];

            for (const trackedEmbed of configData.raksha.trackedEmbeds) {
                try {
                    const guild = this.client.guilds.cache.get(trackedEmbed.guildId);
                    if (!guild) continue;

                    const channel = guild.channels.cache.get(trackedEmbed.channelId);
                    if (!channel?.isTextBased()) continue;

                    const message = await channel.messages.fetch(trackedEmbed.messageId);
                    await message.edit({ embeds: [embed] });

                    validEmbeds.push(trackedEmbed);
                } catch (error) {
                    this.client.logger.error({ message: 'Error updating tracked embed', error });
                }
            }

            configData.raksha.trackedEmbeds = validEmbeds;
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));

        } catch (error) {
            this.client.logger.error({ message: 'Error updating tracked embeds', error });
        }
    }

    public static startAutoUpdater(client: any): void {
        setInterval(async () => {
            try {
                const instance = new BossRevenueV2(client);
                await instance.updateAllTrackedEmbeds();
            } catch (error) {
                client.logger.error({ message: 'Error in auto-updater', error });
            }
        }, 10 * 60 * 1000);
    }
}
