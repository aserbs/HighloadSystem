package org.hazelcast;

import com.hazelcast.cp.IAtomicLong;

public class IncrementStrategies {
    public static class WithoutLocks implements HazelcastCounter.IncrementStrategy {
        private final HazelcastCounter counter;

        public WithoutLocks(HazelcastCounter counter) {
            this.counter = counter;
        }

        @Override
        public void increment() {
            HazelcastCounter.VersionedValue currentValue = counter.counterMap
                    .getOrDefault("counter", new HazelcastCounter.VersionedValue(0, 0));
            counter.counterMap.put("counter",
                    new HazelcastCounter.VersionedValue(currentValue.value + 1, currentValue.version + 1));
        }

        @Override
        public String getName() {
            return "Without Locks";
        }
    }

    public static class PessimisticLocking implements HazelcastCounter.IncrementStrategy {
        private final HazelcastCounter counter;

        public PessimisticLocking(HazelcastCounter counter) {
            this.counter = counter;
        }

        @Override
        public void increment() {
            counter.counterMap.lock("counter");
            try {
                HazelcastCounter.VersionedValue currentValue = counter.counterMap
                        .getOrDefault("counter", new HazelcastCounter.VersionedValue(0, 0));
                counter.counterMap.put("counter",
                        new HazelcastCounter.VersionedValue(currentValue.value + 1, currentValue.version + 1));
            } finally {
                counter.counterMap.unlock("counter");
            }
        }

        @Override
        public String getName() {
            return "Pessimistic Locking";
        }
    }

    public static class OptimisticLocking implements HazelcastCounter.IncrementStrategy {
        private final HazelcastCounter counter;

        public OptimisticLocking(HazelcastCounter counter) {
            this.counter = counter;
        }

        @Override
        public void increment() {
            boolean updated = false;
            while (!updated) {
                HazelcastCounter.VersionedValue originalValue = counter.counterMap.get("counter");
                HazelcastCounter.VersionedValue newValue =
                        new HazelcastCounter.VersionedValue(originalValue.value + 1, originalValue.version + 1);
                updated = counter.counterMap.replace("counter", originalValue, newValue);
            }
        }

        @Override
        public String getName() {
            return "Optimistic Locking";
        }
    }

    public static class IAtomicLongStrategy implements HazelcastCounter.IncrementStrategy {
        private final IAtomicLong atomicLong;

        public IAtomicLongStrategy(IAtomicLong atomicLong) {
            this.atomicLong = atomicLong;
        }

        @Override
        public void increment() {
            atomicLong.incrementAndGet();
        }

        @Override
        public String getName() {
            return "IAtomicLong Strategy";
        }
    }
}