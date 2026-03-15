import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphHopperRoutingProvider } from './graphhopper-routing.provider';
import { MockRoutingProvider } from './mock-routing.provider';
import { RoutingService } from './routing.service';
import type { RoutingProvider } from './types';

export const ROUTING_PROVIDER_TOKEN = Symbol('ROUTING_PROVIDER_TOKEN');

@Module({
  providers: [
    MockRoutingProvider,
    GraphHopperRoutingProvider,
    {
      provide: ROUTING_PROVIDER_TOKEN,
      inject: [ConfigService, GraphHopperRoutingProvider, MockRoutingProvider],
      useFactory: (
        configService: ConfigService,
        graphHopperProvider: GraphHopperRoutingProvider,
        mockProvider: MockRoutingProvider
      ): RoutingProvider => {
        const configuredProvider = configService.get<string>('ROUTING_PROVIDER', 'mock');
        return configuredProvider === 'graphhopper' ? graphHopperProvider : mockProvider;
      }
    },
    {
      provide: RoutingService,
      inject: [MockRoutingProvider, ROUTING_PROVIDER_TOKEN],
      useFactory: (mockProvider: MockRoutingProvider, provider: RoutingProvider) =>
        new RoutingService(mockProvider, provider)
    }
  ],
  exports: [RoutingService]
})
export class RoutingModule {}
