import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm"
import { Reaper } from "./Reaper";

@Entity()
export class ReaperParticipation {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    participant: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(type => Reaper, reaper => reaper.participants) reaper: Reaper;
}
