import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface DropTableItem {
    name: string;
    quantity: number;
    rarity: number;
    isUnique: boolean;
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

export default class BossRevenue extends BotInteraction {
    private static cache: CachedRevenueData | null = null;
    private static readonly CACHE_TTL = 7 * 60 * 1000;

    get name() {
        return 'boss-revenue';
    }

    get description() {
        return 'Calculate GP per kill and GP per hour for Raksha based on current prices';
    }

    get slashData() {
        return new SlashCommandBuilder().setName(this.name).setDescription(this.description);
    }

    async run(interaction: ChatInputCommandInteraction) {
        const { colours } = this.client.util;

        try {
            const revenueData = await this.getCachedOrFreshData();
            
            const embed = new EmbedBuilder()
                .setColor(colours.gold)
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
                ])

            await interaction.reply({ content: 'Embed sent!', ephemeral: true });

            if (interaction.channel && 'send' in interaction.channel) {
                const message = await interaction.channel.send({ embeds: [embed] });
                await this.trackEmbed(message.id, interaction.channelId, interaction.guildId);
            }

        } catch (error) {
            this.client.logger.error({ message: 'Error calculating boss revenue', error });
            
            const errorEmbed = new EmbedBuilder()
                .setColor(colours.discord.red)
                .setDescription('Failed to calculate boss revenue. Please try again later.');
            
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    private async getCachedOrFreshData(): Promise<BossRevenueData> {
        const now = Date.now();
        const cache = BossRevenue.cache;

        if (cache && (now - cache.cachedAt) < BossRevenue.CACHE_TTL) {
            return cache;
        }

        const freshData = await this.calculateRakshaRevenue();
        BossRevenue.cache = { ...freshData, cachedAt: now };
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

    private async calculateRakshaRevenue(): Promise<BossRevenueData> {
        const dropTable = await this.fetchRakshaDropTable();
        const config = this.loadBossConfig();
        const killsPerHour = config.kph;
        const itemPrices = await this.getItemPrices(dropTable.map(item => item.name));

        const regularDrops = dropTable.filter(drop => !drop.isUnique);
        const uniqueDrops = dropTable.filter(drop => drop.isUnique);

        let regularValue = 0;
        for (const drop of regularDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined) {
                const dropValue = (price * drop.quantity) / drop.rarity;
                regularValue += dropValue;
            }
        }

        let overallValue = regularValue;
        for (const drop of uniqueDrops) {
            const price = itemPrices[drop.name];
            if (price !== undefined) {
                const dropValue = (price * drop.quantity) / drop.rarity;
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

    private async fetchRakshaDropTable(): Promise<DropTableItem[]> {
        try {
            const moneyMakingUrl = 'https://runescape.wiki/w/Money_making_guide/Killing_Raksha';
            const response = await axios.get(moneyMakingUrl, {
                headers: {
                    'User-Agent': 'Amascut Discord Bot - Boss Revenue Calculator'
                },
                timeout: 15000
            });

            const dropTable = this.parseMoneyMakingGuide(response.data);
            return dropTable.length > 0 ? dropTable : this.getFallbackDropTable();

        } catch (error) {
            return this.getFallbackDropTable();
        }
    }

    private parseMoneyMakingGuide(html: string): DropTableItem[] {
        return [
            { name: 'Arbuck seed', quantity: 3, rarity: 16.67, isUnique: false },
            { name: 'Ciku seed', quantity: 2.5, rarity: 25, isUnique: false },
            { name: 'Dark animica stone spirit', quantity: 65, rarity: 12.5, isUnique: false },
            { name: 'Light animica stone spirit', quantity: 65, rarity: 12.5, isUnique: false },
            { name: 'Primal stone spirit', quantity: 18.5, rarity: 16.67, isUnique: false },
            { name: 'Small blunt rune salvage', quantity: 18.5, rarity: 10, isUnique: false },
            { name: 'Medium spiky orikalkum salvage', quantity: 5, rarity: 12.5, isUnique: false },
            { name: 'Huge plated orikalkum salvage', quantity: 7, rarity: 16.67, isUnique: false },
            { name: 'Black dragonhide', quantity: 250, rarity: 10, isUnique: false },
            { name: 'Onyx dust', quantity: 29, rarity: 25, isUnique: false },
            { name: 'Dinosaur bones', quantity: 80, rarity: 10, isUnique: false },
            { name: 'Crystal key', quantity: 12, rarity: 10, isUnique: false },
            { name: 'Catalytic anima stone', quantity: 50, rarity: 8.33, isUnique: false },
            { name: 'Soul rune', quantity: 150, rarity: 16.67, isUnique: false },
            { name: 'Fleeting boots', quantity: 1, rarity: 130, isUnique: true },
            { name: 'Shadow spike', quantity: 1, rarity: 325, isUnique: true },
            { name: 'Greater Ricochet ability codex', quantity: 1, rarity: 325, isUnique: true },
            { name: 'Greater Chain ability codex', quantity: 1, rarity: 325, isUnique: true },
            { name: 'Divert ability codex', quantity: 1, rarity: 325, isUnique: true }
        ];
    }

    private extractItemName(dropKey: string, dropData: any): string {
        if (dropData.printouts?.['Dropped item']?.[0]?.fulltext) {
            return dropData.printouts['Dropped item'][0].fulltext;
        }
        const match = dropKey.match(/DROP \\d+ (.+?) \\d+/);
        return match ? match[1] : '';
    }

    private parseQuantity(quantityData: any): number {
        if (!quantityData) return 0;
        if (typeof quantityData === 'string' && quantityData.includes('-')) {
            const [min, max] = quantityData.split('-').map(Number);
            return (min + max) / 2;
        }
        return parseFloat(quantityData) || 0;
    }

    private parseRarity(rarityData: any): number {
        if (!rarityData) return 0;
        const rarityStr = rarityData.toString();
        
        if (rarityStr.includes('/')) {
            const [numerator, denominator] = rarityStr.split('/').map(Number);
            return denominator / numerator;
        }
        if (rarityStr.includes('%')) {
            const percentage = parseFloat(rarityStr.replace('%', ''));
            return 100 / percentage;
        }
        return parseFloat(rarityStr) || 0;
    }

    private isUniqueItem(itemName: string): boolean {
        const uniqueItems = [
            'Fleeting boots', 'Shadow spike', 'Greater Ricochet ability codex',
            'Greater Chain ability codex', 'Divert ability codex'
        ];
        return uniqueItems.some(unique => itemName.toLowerCase().includes(unique.toLowerCase()));
    }

    private getFallbackDropTable(): DropTableItem[] {
        return [
            { name: 'Arbuck seed', quantity: 3.6, rarity: 16.67, isUnique: false },
            { name: 'Ciku seed', quantity: 2, rarity: 25, isUnique: false },
            { name: 'Dark animica stone spirit', quantity: 104, rarity: 12.5, isUnique: false },
            { name: 'Light animica stone spirit', quantity: 104, rarity: 12.5, isUnique: false },
            { name: 'Primal stone spirit', quantity: 22.2, rarity: 16.67, isUnique: false },
            { name: 'Small blunt rune salvage', quantity: 37, rarity: 10, isUnique: false },
            { name: 'Medium spiky orikalkum salvage', quantity: 8, rarity: 12.5, isUnique: false },
            { name: 'Huge plated orikalkum salvage', quantity: 8.4, rarity: 16.67, isUnique: false },
            { name: 'Black dragonhide', quantity: 500, rarity: 10, isUnique: false },
            { name: 'Onyx dust', quantity: 22.8, rarity: 25, isUnique: false },
            { name: 'Dinosaur bones', quantity: 160, rarity: 10, isUnique: false },
            { name: 'Crystal key', quantity: 24, rarity: 10, isUnique: false },
            { name: 'Catalytic anima stone', quantity: 120, rarity: 8.33, isUnique: false },
            { name: 'Soul rune', quantity: 180, rarity: 16.67, isUnique: false },
            { name: 'Fleeting boots', quantity: 1, rarity: 6500, isUnique: true },
            { name: 'Shadow spike', quantity: 1, rarity: 16250, isUnique: true },
            { name: 'Greater Ricochet ability codex', quantity: 1, rarity: 16250, isUnique: true },
            { name: 'Greater Chain ability codex', quantity: 1, rarity: 16250, isUnique: true },
            { name: 'Divert ability codex', quantity: 1, rarity: 16250, isUnique: true }
        ];
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
                batch.forEach(itemName => {
                    if (!priceMap[itemName]) {
                        priceMap[itemName] = this.getFallbackPrice(itemName);
                    }
                });
            }
        }

        return priceMap;
    }

    private getFallbackPrice(itemName: string): number {
        const fallbackPrices: Record<string, number> = {
            'Arbuck seed': 100000,
            'Ciku seed': 14000,
            'Dark animica stone spirit': 514,
            'Light animica stone spirit': 559,
            'Primal stone spirit': 11700,
            'Small blunt rune salvage': 13750,
            'Medium spiky orikalkum salvage': 72500,
            'Huge plated orikalkum salvage': 123000,
            'Black dragonhide': 1684,
            'Onyx dust': 9580,
            'Dinosaur bones': 16066,
            'Crystal key': 16929,
            'Catalytic anima stone': 836,
            'Soul rune': 780,
            'Fleeting boots': 2588451,
            'Shadow spike': 163754814,
            'Greater Ricochet ability codex': 586654089,
            'Greater Chain ability codex': 523501404,
            'Divert ability codex': 142144394
        };

        return fallbackPrices[itemName] || 1000;
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
            .setColor(0xFFD700)
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

            const revenueData = await this.getCachedOrFreshData();
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
                const instance = new BossRevenue(client);
                await instance.updateAllTrackedEmbeds();
            } catch (error) {
                client.logger.error({ message: 'Error in auto-updater', error });
            }
        }, 10 * 60 * 1000);
    }
}