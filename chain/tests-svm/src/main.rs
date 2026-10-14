//! Replays fixture.json (instructions built by lib/chain/program.ts) against the compiled program in
//! LiteSVM, checks every step succeeds or fails as expected, and writes the final accounts to
//! accounts.json so the TypeScript decoders can be checked too.
use litesvm::LiteSVM;
use serde_json::{json, Value};
use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;
use std::{collections::HashMap, fs, str::FromStr};

fn hex(s: &str) -> Vec<u8> {
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap()).collect()
}
fn to_hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn main() {
    let fx: Value = serde_json::from_str(&fs::read_to_string("fixture.json").expect("run fixture.ts first")).unwrap();
    let mut svm = LiteSVM::new();
    let program = Address::from_str(fx["program"].as_str().unwrap()).unwrap();
    svm.add_program_from_file(program, "../target/deploy/engram_registry.so").expect("build the program first");

    let mut keys: HashMap<String, Keypair> = HashMap::new();
    for (name, n) in fx["seeds"].as_object().unwrap() {
        let kp = Keypair::new_from_array([n.as_u64().unwrap() as u8; 32]);
        svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        keys.insert(name.clone(), kp);
    }

    let mut failures = 0;
    for s in fx["steps"].as_array().unwrap() {
        let ix = Instruction {
            program_id: Address::from_str(s["program"].as_str().unwrap()).unwrap(),
            accounts: s["keys"].as_array().unwrap().iter().map(|k| {
                let pk = Address::from_str(k["pubkey"].as_str().unwrap()).unwrap();
                if k["writable"].as_bool().unwrap() { AccountMeta::new(pk, k["signer"].as_bool().unwrap()) }
                else { AccountMeta::new_readonly(pk, k["signer"].as_bool().unwrap()) }
            }).collect(),
            data: hex(s["data"].as_str().unwrap()),
        };
        let signers: Vec<&Keypair> = s["signers"].as_array().unwrap().iter().map(|n| &keys[n.as_str().unwrap()]).collect();
        svm.expire_blockhash();
        let tx = Transaction::new_signed_with_payer(&[ix], Some(&signers[0].pubkey()), &signers, svm.latest_blockhash());
        let res = svm.send_transaction(tx);
        let want = s["ok"].as_bool().unwrap();
        let got = res.is_ok();
        let name = s["name"].as_str().unwrap();
        if got == want {
            println!("  ok    {name}{}", if want { "" } else { " (rejected, as it should be)" });
        } else {
            failures += 1;
            println!("  FAIL  {name}: expected {}, got {}", if want { "success" } else { "failure" }, if got { "success" } else { "failure" });
            match res {
                Ok(m) => println!("{}", m.logs.join("\n")),
                Err(e) => println!("{:?}\n{}", e.err, e.meta.logs.join("\n")),
            }
        }
    }

    let mut out = serde_json::Map::new();
    for (name, addr) in fx["dump"].as_object().unwrap() {
        let a = svm.get_account(&Address::from_str(addr.as_str().unwrap()).unwrap());
        out.insert(name.clone(), json!(a.map(|a| to_hex(&a.data))));
    }
    fs::write("accounts.json", serde_json::to_string_pretty(&Value::Object(out)).unwrap()).unwrap();
    println!("{} steps, {} unexpected", fx["steps"].as_array().unwrap().len(), failures);
    if failures > 0 { std::process::exit(1); }
}
