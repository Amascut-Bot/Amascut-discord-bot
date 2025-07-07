import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class DpmSubmission {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: string;

    @Column()
    rsn: string;

    @Column({ nullable: true })
    style: string;

    @Column({ nullable: true, default: 'Duo' })
    teamSize: string;

    @Column('decimal', { precision: 10, scale: 2 })
    dpm: number;

    @Column()
    damage: string;

    @Column()
    time: string;

    @Column()
    roleId: string;

    @Column()
    firstScreenshot: string;

    @Column()
    secondScreenshot: string;

    @Column()
    approvedBy: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    approvedAt: Date;

    @Column({ default: 'pending' })
    status: string; // pending, approved, rejected
} 