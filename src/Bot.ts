import 'dotenv/config';
import { Client, ClientOptions } from 'discord.js';
import BotLogger from './modules/LoggingHandler';
import InteractionHandler from './modules/InteractionHandler';
import EventHandler from './modules/EventHandler';
import UtilityHandler from './modules/UtilityHandler';
import TempChannelManager from './modules/TempVCHandler';
import { DataSource } from "typeorm"
import { AppDataSource } from './DataSource';

export default interface Bot extends Client {
    color: number;
    dataSource: DataSource;
    commandsRun: number;
    util: UtilityHandler;
    quitting?: boolean;
    location?: string;
    logger: BotLogger;
    interactions: InteractionHandler;
    events: EventHandler;
    tempManager: TempChannelManager;
}

export default class Bot extends Client {
    constructor(options: ClientOptions) {
        super(options);

        AppDataSource.initialize().then(() => {
            console.log("Data Source has been initialized!")
        })
        .catch((err) => {
            console.error("Error during Data Source initialization", err)
        });
        
        this.color = 0x7e686c;
        this.dataSource = AppDataSource;
        this.commandsRun = 0;
        this.util = new UtilityHandler(this);
        this.quitting = false;
        this.location = process.cwd();
        this.logger = new BotLogger();
        this.interactions = new InteractionHandler(this).build();
        this.events = new EventHandler(this).build();
        this.tempManager = new TempChannelManager(this);

        process.on('unhandledRejection', (err: any): void => {
            this.logger.error({ message: `UnhandledRejection from Process`, error: err.stack });
        });

        ['beforeExit', 'SIGUSR1', 'SIGUSR2', 'SIGINT', 'SIGTERM'].map((event: string) => process.once(event, this.exit.bind(this)));
    }

    async login() {
        await super.login(process.env.TOKEN);
        return this.constructor.name;
    }

    exit() {
        if (this.quitting) return;
        this.quitting = true;
        this.destroy();
    }
}
