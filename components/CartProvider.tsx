
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_DISPLAY_CURRENCY,
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  type SupportedCurrency,
} from '../lib/currency';

export type DisplayCurrency = SupportedCurrency;

export type CartItem = {
  id: string;
  eventId: string;
  eventName: string;
  sport: string;
  eventDate?: string;
  category: string;
  session?: string;
  quantity: number;
  price?: number;
  currency?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  total: number | null;
  currency: string | null;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
};

const CartContext =
  createContext<CartContextType | undefined>(
    undefined
  );

const CART_STORAGE_KEY =
  'grandstand-pass-cart';

const CURRENCY_STORAGE_KEY =
  'grandstand-pass-display-currency';

export const DISPLAY_CURRENCIES:
  DisplayCurrency[] = [...SUPPORTED_CURRENCIES];

function isCartItem(value: unknown): value is CartItem {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const item = value as Partial<CartItem>;

  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.eventId === 'string' &&
    typeof item.eventName === 'string' &&
    typeof item.sport === 'string' &&
    typeof item.category === 'string' &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 10 &&
    (
      item.price === undefined ||
      (
        typeof item.price === 'number' &&
        Number.isFinite(item.price) &&
        item.price >= 0
      )
    ) &&
    (
      item.currency === undefined ||
      typeof item.currency === 'string'
    )
  );
}

function hasValidPricing(
  item: CartItem
): boolean {
  return (
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price > 0 &&
    isSupportedCurrency(item.currency)
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [isLoaded, setIsLoaded] =
    useState(false);

  const [
    displayCurrency,
    setDisplayCurrencyState,
  ] = useState<DisplayCurrency>(
    DEFAULT_DISPLAY_CURRENCY
  );

  useEffect(() => {
    try {
      const savedCart =
        localStorage.getItem(
          CART_STORAGE_KEY
        );

      if (savedCart) {
        const parsed: unknown =
          JSON.parse(savedCart);

        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(isCartItem)
          );
        }
      }
    } catch (error) {
      console.error(
        'Unable to load shopping cart:',
        error
      );
    }

    try {
      const savedCurrency =
        localStorage.getItem(
          CURRENCY_STORAGE_KEY
        );

      if (
        isSupportedCurrency(
          savedCurrency
        )
      ) {
        setDisplayCurrencyState(
          savedCurrency
        );
      }
    } catch (error) {
      console.error(
        'Unable to load display currency:',
        error
      );
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch (error) {
      console.error(
        'Unable to save shopping cart:',
        error
      );
    }
  }, [items, isLoaded]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    try {
      localStorage.setItem(
        CURRENCY_STORAGE_KEY,
        displayCurrency
      );
    } catch (error) {
      console.error(
        'Unable to save display currency:',
        error
      );
    }
  }, [
    displayCurrency,
    isLoaded,
  ]);

  const setDisplayCurrency = (
    nextCurrency: DisplayCurrency
  ) => {
    if (
      !isSupportedCurrency(
        nextCurrency
      )
    ) {
      return;
    }

    setDisplayCurrencyState(
      nextCurrency
    );
  };

  const addItem = (
    newItem: CartItem
  ) => {
    if (
      !isCartItem(newItem)
    ) {
      return;
    }

    setItems(
      (currentItems) => {
        const existingItem =
          currentItems.find(
            (item) =>
              item.id === newItem.id
          );

        if (existingItem) {
          return currentItems.map(
            (item) =>
              item.id === newItem.id
                ? {
                    ...item,
                    quantity:
                      Math.min(
                        10,
                        item.quantity +
                          newItem.quantity
                      ),
                  }
                : item
          );
        }

        return [
          ...currentItems,
          newItem,
        ];
      }
    );
  };

  const removeItem = (
    id: string
  ) => {
    setItems(
      (currentItems) =>
        currentItems.filter(
          (item) =>
            item.id !== id
        )
    );
  };

  const updateQuantity = (
    id: string,
    quantity: number
  ) => {
    if (
      !Number.isInteger(
        quantity
      )
    ) {
      return;
    }

    if (
      quantity <= 0
    ) {
      removeItem(id);
      return;
    }

    setItems(
      (currentItems) =>
        currentItems.map(
          (item) =>
            item.id === id
              ? {
                  ...item,
                  quantity:
                    Math.min(
                      10,
                      quantity
                    ),
                }
              : item
        )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount =
    items.reduce(
      (count, item) =>
        count +
        item.quantity,
      0
    );

  const hasCompletePricing =
    items.length > 0 &&
    items.every(
      hasValidPricing
    );

  const originalCurrencies =
    hasCompletePricing
      ? [
          ...new Set(
            items.map(
              (item) =>
                item.currency
            )
          ),
        ]
      : [];

  const currency =
    originalCurrencies.length === 1
      ? originalCurrencies[0] ??
        null
      : null;

  const total =
    hasCompletePricing &&
    currency !== null
      ? items.reduce(
          (sum, item) =>
            sum +
            (item.price ?? 0) *
              item.quantity,
          0
        )
      : null;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        total,
        currency,
        displayCurrency,
        setDisplayCurrency,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (!context) {
    throw new Error(
      'useCart must be used within a CartProvider'
    );
  }

  return context;
}
