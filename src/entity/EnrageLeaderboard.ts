import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class EnrageLeaderboard {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    guild: string;

    @Column()
    enrage: number;

    @Column()
    rsn1: string;

    @Column()
    disc1: string;

    @Column()
    rsn2: string;

    @Column()
    disc2: string;

    @Column({ nullable: true })
    rsn3: string;

    @Column({ nullable: true })
    disc3: string;

    @Column({ nullable: true })
    rsn4: string;

    @Column({ nullable: true })
    disc4: string;

    @Column({ nullable: true })
    rsn5: string;

    @Column({ nullable: true })
    disc5: string;

    @Column()
    screenshot: string;

    @Column({ name: 'datetime' })
    createdAt: Date;

    @Column({ nullable: true })
    approvedBy: string;

    @Column({ nullable: true, type: 'datetime' })
    approvedAt: Date;

    @Column({ default: 'open' })
    status: string; // open, approved, rejected
}
