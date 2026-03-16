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
        const configuredProviderRaw = configService.get<string>('ROUTING_PROVIDER');
        if (!configuredProviderRaw) {
          throw new Error('ROUTING_PROVIDER must be set to "graphhopper" or "mock".');
        }

        const configuredProvider = configuredProviderRaw.toLowerCase();
        if (configuredProvider === 'graphhopper') {
          return graphHopperProvider;
        }
        if (configuredProvider === 'mock') {
          return mockProvider;
        }

        throw new Error(
          `Invalid ROUTING_PROVIDER value "${configuredProviderRaw}". Expected "graphhopper" or "mock".`
        );
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
