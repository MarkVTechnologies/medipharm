<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Drug;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\Subscription;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use App\Services\CheckoutService;
use App\Services\StockService;
use App\Support\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * A realistic Lagos community pharmacy for local development and demos.
 * Logins (password "password"):
 *   owner@medipharm.test · pharmacist@medipharm.test · assistant@medipharm.test
 */
class DemoPharmacySeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::create([
            'name' => 'HealthPlus Pharmacy, Yaba',
            'slug' => 'healthplus-yaba',
            'address' => '14 Herbert Macaulay Way, Yaba, Lagos',
            'phone' => '0803 555 0142',
            'email' => 'owner@medipharm.test',
            'licence_number' => 'PCN/LAG/2026/0142',
            'vat_rate' => 7.5,
            'receipt_footer' => 'Thank you for your patronage. Get well soon! Goods sold in good condition are not returnable.',
            'status' => 'trial',
            'trial_ends_at' => now()->addDays(30),
        ]);

        $context = app(TenantContext::class);
        $context->set($tenant->id);

        Subscription::create(['plan' => 'starter', 'status' => 'trial', 'starts_at' => now(), 'renews_at' => $tenant->trial_ends_at]);

        $owner = User::create(['name' => 'Sarah Adeyemi', 'email' => 'owner@medipharm.test', 'password' => 'password', 'role' => 'owner']);
        $pharmacist = User::create(['name' => 'Tunde Bakare', 'email' => 'pharmacist@medipharm.test', 'password' => 'password', 'role' => 'pharmacist']);
        $assistant = User::create(['name' => 'James Okafor', 'email' => 'assistant@medipharm.test', 'password' => 'password', 'role' => 'assistant']);

        $suppliers = collect([
            ['name' => 'Emzor Pharmaceutical Industries', 'contact_person' => 'Mrs. Ngozi Eze', 'phone' => '0802 111 2233', 'email' => 'orders@emzor.example', 'address' => 'Isolo, Lagos', 'payment_terms' => 'Net 30'],
            ['name' => 'Fidson Healthcare', 'contact_person' => 'Mr. Kola Ade', 'phone' => '0803 444 5566', 'email' => 'sales@fidson.example', 'address' => 'Obanikoro, Lagos', 'payment_terms' => 'Net 14'],
            ['name' => 'May & Baker Nigeria', 'contact_person' => 'Ms. Ife Ojo', 'phone' => '0805 777 8899', 'email' => 'trade@maybaker.example', 'address' => 'Ikeja, Lagos', 'payment_terms' => 'Cash on delivery'],
        ])->map(fn ($s) => Supplier::create($s));

        // name, generic, brand, category, form, strength, pack, cost, price, reorder, tax(null=default)
        $catalogue = [
            ['Paracetamol 500mg Tablets', 'Paracetamol', 'Emzor', 'Analgesics', 'Tablet', '500mg', '10x10', 850, 1200, 30, null],
            ['Panadol Extra', 'Paracetamol + Caffeine', 'GSK', 'Analgesics', 'Tablet', '500/65mg', '12 caplets', 900, 1300, 20, null],
            ['Ibuprofen 400mg', 'Ibuprofen', 'May & Baker', 'Analgesics', 'Tablet', '400mg', '10x10', 1100, 1600, 15, null],
            ['Amoxicillin 500mg Capsules', 'Amoxicillin', 'Fidson', 'Antibiotics', 'Capsule', '500mg', '10x10', 1500, 2200, 15, null],
            ['Augmentin 625mg', 'Amoxicillin + Clavulanate', 'GSK', 'Antibiotics', 'Tablet', '625mg', '14 tabs', 6800, 8900, 8, null],
            ['Ciprofloxacin 500mg', 'Ciprofloxacin', 'Fidson', 'Antibiotics', 'Tablet', '500mg', '10 tabs', 1200, 1800, 10, null],
            ['Metronidazole 400mg', 'Metronidazole', 'Emzor', 'Antibiotics', 'Tablet', '400mg', '10x10', 700, 1000, 15, null],
            ['Coartem 80/480', 'Artemether + Lumefantrine', 'Novartis', 'Antimalarials', 'Tablet', '80/480mg', '6 tabs', 3200, 4500, 20, 0],
            ['Lonart DS', 'Artemether + Lumefantrine', 'Bliss GVS', 'Antimalarials', 'Tablet', '80/480mg', '6 tabs', 2100, 3000, 20, 0],
            ['P-Alaxin', 'Dihydroartemisinin + Piperaquine', 'Bliss GVS', 'Antimalarials', 'Tablet', '40/320mg', '9 tabs', 2600, 3600, 10, 0],
            ['Amlodipine 10mg', 'Amlodipine', 'Pfizer', 'Cardiovascular', 'Tablet', '10mg', '28 tabs', 1900, 2800, 10, 0],
            ['Lisinopril 10mg', 'Lisinopril', 'Teva', 'Cardiovascular', 'Tablet', '10mg', '28 tabs', 1600, 2400, 10, 0],
            ['Metformin 500mg', 'Metformin', 'Glucophage', 'Antidiabetics', 'Tablet', '500mg', '30 tabs', 1300, 2000, 12, 0],
            ['Vitamin C 1000mg', 'Ascorbic Acid', 'Emzor', 'Vitamins & Supplements', 'Tablet', '1000mg', '30 tabs', 1400, 2100, 10, null],
            ['Multivite Syrup', 'Multivitamin', 'Emzor', 'Vitamins & Supplements', 'Syrup', '100ml', '1 bottle', 650, 950, 10, null],
            ['Ferrous Sulphate 200mg', 'Ferrous Sulphate', 'May & Baker', 'Vitamins & Supplements', 'Tablet', '200mg', '10x10', 500, 800, 10, null],
            ['Loratadine 10mg', 'Loratadine', 'Fidson', 'Antihistamines', 'Tablet', '10mg', '10 tabs', 600, 950, 10, null],
            ['Piriton 4mg', 'Chlorphenamine', 'GSK', 'Antihistamines', 'Tablet', '4mg', '30 tabs', 450, 700, 10, null],
            ['Benylin Original', 'Diphenhydramine', 'J&J', 'Cough & Cold', 'Syrup', '100ml', '1 bottle', 1800, 2600, 8, null],
            ['Omeprazole 20mg', 'Omeprazole', 'Fidson', 'Gastrointestinal', 'Capsule', '20mg', '14 caps', 900, 1400, 10, null],
            ['ORS Sachets', 'Oral Rehydration Salts', 'Emzor', 'Gastrointestinal', 'Powder', '20.5g', '1 sachet', 120, 200, 40, 0],
            ['Gestid Tablets', 'Antacid', 'Fidson', 'Gastrointestinal', 'Tablet', '-', '10x10', 800, 1200, 10, null],
            ['Hydrocortisone Cream 1%', 'Hydrocortisone', 'May & Baker', 'Dermatologicals', 'Cream', '1%', '15g tube', 550, 900, 8, null],
            ['Salbutamol Inhaler', 'Salbutamol', 'GSK', 'Respiratory', 'Inhaler', '100mcg', '200 doses', 2900, 4200, 6, 0],
            ['Surgical Face Mask', 'Face mask', 'Generic', 'Medical Devices', 'Device', '-', '50 pcs', 1500, 2500, 5, null],
        ];

        $stock = app(StockService::class);
        $drugs = collect();

        foreach ($catalogue as $i => [$name, $generic, $brand, $category, $form, $strength, $pack, $cost, $price, $reorder, $tax]) {
            $drug = Drug::create([
                'name' => $name, 'generic_name' => $generic, 'brand' => $brand, 'category' => $category,
                'form' => $form, 'strength' => $strength, 'pack_size' => $pack,
                'nafdac_number' => sprintf('A4-%04d', 1200 + $i),
                'barcode' => '61511000'.str_pad((string) (10000 + $i), 5, '0', STR_PAD_LEFT),
                'cost_price' => $cost, 'selling_price' => $price, 'tax_rate' => $tax, 'reorder_level' => $reorder,
                'preferred_supplier_id' => $suppliers[$i % 3]->id,
            ]);
            $drugs->push($drug);

            // Shape the demo: a few low/out items, a few near-expiry batches.
            $qty = match (true) {
                $i % 11 === 4 => 0,
                $i % 7 === 3 => max(1, intdiv($reorder, 2)),
                default => $reorder * 4 + ($i * 7) % 40,
            };
            if ($qty > 0) {
                $stock->receiveBatch($drug, $owner, [
                    'batch_number' => strtoupper(substr($brand, 0, 3)).'24'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'expiry_date' => now()->addDays($i % 5 === 0 ? 25 + $i : 300 + $i * 10)->toDateString(),
                    'quantity' => $qty,
                    'cost_price' => $cost,
                    'supplier_id' => $suppliers[$i % 3]->id,
                ]);
            }
            if ($i % 4 === 1) {
                $stock->receiveBatch($drug, $owner, [
                    'batch_number' => strtoupper(substr($brand, 0, 3)).'25'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'expiry_date' => now()->addDays(540)->toDateString(),
                    'quantity' => $reorder * 2,
                    'cost_price' => $cost,
                    'supplier_id' => $suppliers[$i % 3]->id,
                ]);
            }
        }

        // One already-expired batch, to show the expiry alert and write-off.
        $stock->receiveBatch($drugs[6], $owner, [
            'batch_number' => 'EMZ23OLD', 'expiry_date' => now()->subDays(5)->toDateString(), 'quantity' => 12, 'cost_price' => 700,
        ]);

        $customers = collect([
            ['Adaeze Nwosu', '0803 123 4567'], ['Bola Tinubu-Ade', '0805 222 1111'], ['Chinedu Obi', '0806 333 4444'],
            ['Damilola Akin', '0807 555 6666'], ['Emeka Uche', '0809 777 8888'], ['Funke Bello', '0810 999 0000'],
            ['Gbenga Salami', '0811 123 9876'], ['Halima Musa', '0812 456 7890'],
        ])->map(fn ($c, $i) => Customer::create([
            'code' => sprintf('CUS-%04d', $i + 1), 'name' => $c[0], 'phone' => $c[1], 'tier' => 'bronze',
        ]));

        // ~30 days of trading history through the real checkout path.
        $checkout = app(CheckoutService::class);
        $staff = [$owner, $pharmacist, $assistant, $assistant];
        $methods = ['cash', 'cash', 'transfer', 'card'];
        mt_srand(42);

        for ($day = 29; $day >= 0; $day--) {
            $salesToday = $day === 0 ? 6 : mt_rand(4, 11);
            for ($n = 0; $n < $salesToday; $n++) {
                $basket = collect(range(1, mt_rand(1, 4)))->map(fn () => [
                    'drug_id' => $drugs[mt_rand(0, $drugs->count() - 1)]->id,
                    'quantity' => mt_rand(1, 3),
                ])->all();
                $method = $methods[mt_rand(0, 3)];

                try {
                    $sale = $checkout->checkout($staff[mt_rand(0, 3)], [
                        'items' => $basket,
                        'customer_id' => mt_rand(0, 2) === 0 ? $customers[mt_rand(0, $customers->count() - 1)]->id : null,
                        'payment_method' => $method,
                        'amount_tendered' => $method === 'cash' ? 100000 : null,
                    ]);
                } catch (\Throwable) {
                    continue; // out of stock in the demo data — skip
                }

                // Cash change on a ₦100k note is silly; round tendered up to the next ₦1,000.
                if ($method === 'cash') {
                    $tendered = ceil((float) $sale->total / 1000) * 1000;
                    $sale->update(['amount_tendered' => $tendered, 'change_given' => round($tendered - (float) $sale->total, 2)]);
                }

                $at = Carbon::now('Africa/Lagos')->subDays($day)->setTime(mt_rand(8, 20), mt_rand(0, 59))->utc();
                if ($at->isFuture()) {
                    $at = now()->subMinutes(mt_rand(5, 120));
                }
                Sale::query()->whereKey($sale->id)->update(['created_at' => $at, 'updated_at' => $at]);
                StockMovement::query()->where('reference_type', 'sale')->where('reference_id', $sale->id)->update(['created_at' => $at]);
            }
        }

        Customer::query()->each(function (Customer $c) {
            $last = Sale::query()->where('customer_id', $c->id)->max('created_at');
            $c->update(['last_visit_at' => $last]);
        });

        $context->set(null);
    }
}
