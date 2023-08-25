import { ProjectsInterface } from "../src";
import { ModuleFactory } from "../src/module-factory";
import * as process from "process";
import { AvailableProjects } from "../../projects";
import BigNumber from 'bignumber.js';
import { ApiConfigService } from "@libs/common";
import configuration from '../../../config/configuration';
import { ConfigService } from "@nestjs/config";
const request = require('supertest');

function isCloseTo(value1: number, value2: number, margin = 10) {
    const difference = Math.abs(value1 - value2);
    const allowedDifference = (margin / 100) * value1;
    return difference <= allowedDifference;
}

describe('Projects service testing', () => {
    const ACCEPTABLE_PERCENTAGE_DIFFERENCE = 10;
    const API_SLEEP_TIME = 10000;
    const BATCH_API_REQUEST_SIZE = 10;

    let service: ProjectsInterface;
    let batchIterations = 0;
    let apiConfigService: ApiConfigService;
    beforeAll(() => {
        const module: AvailableProjects = process.env.MODULE_NAME as AvailableProjects || AvailableProjects.Sample; // default to 'Sample' if no env provided
        service = ModuleFactory.getService(module);
        const configService = new ConfigService(configuration());
        apiConfigService = new ApiConfigService(configService);
    });


    it('should be defined', () => {
        expect(service).toBeDefined();
        expect(service).toHaveProperty('getAddressStake');
        expect(service).toHaveProperty('getStakingAddresses');
        expect(service).toHaveProperty('getStakingContracts');
    });

    it('should not have empty staking address list', async () => {
        const stakingAddresses = await service.getStakingAddresses();
        expect(stakingAddresses.length).toBeGreaterThan(0);
    });

    it('should not have empty staking contract list', async () => {
        const stakingContracts = await service.getStakingContracts();
        expect(stakingContracts.length).toBeGreaterThan(0);
    });

    it('should return the contract stake amount', async () => {
        const stakingAddresses = await service.getStakingAddresses();
        const random = Math.floor(Math.random() * stakingAddresses.length);
        const stake = await service.getAddressStake(stakingAddresses[random]);
        expect(stake).toHaveProperty('stake');
        expect(stake?.stake).toBeDefined();
        expect(stake?.stake).not.toBeNull();
    });

    it('should check the total staked amount is equal to the sum of all staking addresses', async () => {
        const contractAddresses = await service.getStakingContracts();
        const stakingAddresses = await service.getStakingAddresses();
        let contractSum = new BigNumber(0);
        let addressSum = new BigNumber(0);
        for (const contract of contractAddresses) {
            try {
                const { body: contractData } = await request(`${apiConfigService.getApiUrl()}`).get(`/accounts/${contract}/delegation`);
                contractSum = contractData.reduce((acc: BigNumber, curr: any) => {
                    return acc.plus(curr.userActiveStake);
                }, contractSum);
            } catch (e) {
                throw new Error(`Error at contract ${contract}: ${e}`);
            }
            for (const stakeAddress of stakingAddresses) {
                try {
                    const addressBalance = await service.getAddressStake(stakeAddress);
                    if (addressBalance?.stake === undefined) throw new Error(`Address ${stakeAddress} has undefined stake`);
                    addressSum = addressSum.plus(addressBalance.stake);
                    if (batchIterations % BATCH_API_REQUEST_SIZE === 0) {
                        await new Promise(resolve => setTimeout(resolve, API_SLEEP_TIME));
                        console.log(`Batch ${batchIterations} executed`);
                    }
                    batchIterations++;
                } catch (e) {
                    throw new Error(`Error at batch ${batchIterations}: ${e}`);
                }
            }
            const denominatedContractSum = contractSum.shiftedBy(-18).toNumber();
            const denominatedAddressSum = addressSum.shiftedBy(-18).toNumber();
            console.log(`Contract sum: ${denominatedContractSum}`);
            console.log(`Address sum: ${denominatedAddressSum}`);
            expect(isCloseTo(denominatedContractSum, denominatedAddressSum, ACCEPTABLE_PERCENTAGE_DIFFERENCE)).toBe(true);
        }
    }, 1000000);
});

